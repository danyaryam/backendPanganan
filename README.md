Install ExpressJS with "npm install express"

For other dependencies, such as npm install cors, npm install pg. If you clone via https on GitHub, simply run "npm install express"

Then create a .env file to connect the code to the database.

Here, I'm using NeonDB for the database. In .env, I fill it with "DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/dbname
" and adjust the rest.

then run the API with "node server.js"
