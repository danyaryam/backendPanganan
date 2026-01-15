import express from "express"
import "dotenv/config"
import cors from "cors"
import { pool } from "./db.js"

const app = express()
app.use(cors())
app.use(express.json())

app.get("/products", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM products")
        res.json(result.rows)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})
app.get("/best-products", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM products WHERE is_best_product = true")
        res.json(result.rows)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.get("/products/:id", async (req, res) => {
    try {
        const { id } = req.params
        const result = await pool.query(
            "SELECT * FROM products WHERE id = $1",
            [id]
        )
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Product tidak ditemukan" })
        }
        res.json(result.rows[0])
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post("/products", async (req, res) => {
    try {
        const { kode, nama, harga, gambar } = req.body

        if (!kode || !nama || !harga) {
            return res.status(400).json({ message: "Kode, nama, dan harga wajib diisi" })
        }
        const result = await pool.query(
            "INSERT INTO products (kode, nama, harga, gambar) VALUES ($1, $2, $3, $4) RETURNING *",
            [kode, nama, harga, gambar || null]
        )
        res.status(201).json(result.rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: err.message })
    }
})

app.put("/products/:id", async (req, res) => {
    try {
        const { id } = req.params
        const { kode, nama, harga, gambar } = req.body

        const result = await pool.query(
            `UPDATE products 
             SET kode = $1, nama = $2, harga = $3, gambar = $4
             WHERE id = $5
             RETURNING *`,
            [kode, nama, harga, gambar || null, id]
        )
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Product tidak ditemukan" })
        }
        res.json(result.rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: err.message })
    }
})

app.delete("/products/:id", async (req, res) => {
    try {
        const { id } = req.params

        const result = await pool.query(
            "DELETE FROM products WHERE id = $1 RETURNING *",
            [id]
        )
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Product tidak ditemukan" })
        }

        res.json({ message: "Product berhasil dihapus" })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post("/keranjangs", async (req, res) => {
    try {
        const { product_id, jumlah_pemesanan, keterangan } = req.body

        if (!product_id || !jumlah_pemesanan) {
            return res.status(400).json({ message: "Data tidak lengkap" })
        }
        const result = await pool.query(
            `INSERT INTO keranjangs (product_id, jumlah_pemesanan, keterangan)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [product_id, jumlah_pemesanan, keterangan]
        )
        res.status(201).json(result.rows[0])
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.get("/keranjangs", async (req, res) => {
    try {
        const result = await pool.query(
            `
        SELECT 
                k.id,
                k.jumlah_pemesanan,
                k.keterangan,
                p.nama,
                p.harga,
                p.gambar,
                (k.jumlah_pemesanan * p.harga) AS total_harga
            FROM keranjangs k
            JOIN products p ON p.id = k.product_id
            ORDER BY k.id DESC
    `)
        res.json(result.rows)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.delete("/keranjangs/:id", async (req, res) => {
    try {
        const { id } = req.params
        const result = await pool.query(
            "DELETE FROM keranjangs WHERE id = $1",
            [id]
        )
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Keranjang tidak ditemukan" })
        }
        res.json({ message: "Keranjang berhasil dihapus" })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})


app.post("/pesanans", async (req, res) => {
    const client = await pool.connect()
    try {
        const { nama, noMeja, keranjangs } = req.body

        if (!nama || !noMeja || !Array.isArray(keranjangs) || keranjangs.length === 0) {
            return res.status(400).json({ message: "Data tidak lengkap" })
        }
        await client.query("BEGIN")

        // SIMPAN PESANAN + KERANJANG (WAJIB KARENA NOT NULL)
        await client.query(
            `
            INSERT INTO pesanans (nama, no_meja, keranjangs, status)
            VALUES ($1, $2, $3, 'pending')
            `,
            [nama, noMeja, JSON.stringify(keranjangs)]
        )

        await client.query("DELETE FROM keranjangs")
        await client.query("COMMIT")
        res.status(201).json({ message: "Checkout berhasil" })
    } catch (err) {
        await client.query("ROLLBACK")
        console.error("Checkout error:", err)
        res.status(500).json({
            message: "Gagal checkout",
            error: err.message
        })
    } finally {
        client.release()
    }
})

app.get("/test", (req, res) => {
    res.json({ message: "OK" })
})

app.get("/admin/pesanans", async (req, res) => {
    const result = await pool.query(`
        SELECT * FROM pesanans
        WHERE status = 'pending'
        ORDER BY created_at ASC
    `)
    res.json(result.rows)
})
app.get("/admin/pesanans/:id", async (req, res) => {
    const { id } = req.params

    const items = await pool.query(`
        SELECT 
            pi.id,
            p.nama,
            p.harga,
            pi.jumlah
        FROM pesanan_items pi
        JOIN products p ON p.id = pi.product_id
        WHERE pi.pesanan_id = $1
    `, [id])

    res.json(items.rows)
})
app.delete("/admin/pesanans/:id", async (req, res) => {
    const { id } = req.params
    await pool.query("DELETE FROM pesanans WHERE id = $1", [id])
    res.json({ message: "Pesanan selesai" })
})

app.listen(3000, () => {
    console.log("API running on http://localhost:3000")
})
