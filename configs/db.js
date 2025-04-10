const express = require('mysql2');
const connection = express.createConnection({
    host: 'localhost',
    user: 'root',
    password : '',
    database: 'advanced_serverside_db',
});

connection.connect((err) =>{
    if(err){
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to the database');
});

module.exports = connection;