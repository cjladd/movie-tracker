# Movie Tracker Project

This repository contains the source code for the **Movie Tracker** web application.  The goal of this project is to provide a simple movie‑tracking platform where users can browse movies, see details and save them to personal lists.

The project is organised into three key parts:

* **frontend** – a React application responsible for the user interface.
* **backend** – an API server that contains the business logic and communicates with the database.
* **database** – SQL scripts used to create and manage the application's data schema.

## Getting Started

### Prerequisites

To run this project locally you will need the following tools installed:

* **Node.js** (version 18 or higher) and npm – required for both the backend and frontend.
* **A SQL database server** such as MySQL or PostgreSQL.  SQLite can be used for local development if preferred.
* **(Optional)** PHP – if you choose to use a PHP‑based backend instead of the provided Node.js example.

### Initial Setup

1. **Clone this repository** using your Git provider of choice.
2. **Create the database schema**.  Execute the SQL statements in `database/schema.sql` against your database server to create the necessary tables.
3. **Configure environment variables**.  Copy `backend/.env.example` to `backend/.env` and update the values with your database credentials and desired port.
4. **Install dependencies and start the backend**:

   ```bash
   cd backend
   npm install
   npm start
   ```

5. **Install dependencies and start the frontend**:

   ```bash
   cd frontend
   npm install
   npm start
   ```

   By default the React development server runs on port 3000 and proxies API requests to the backend (see the `proxy` setting in `frontend/package.json`).  Once both servers are running you can open the frontend application at `http://localhost:3000` and it will communicate with the API server on the configured port (default 4000).

## Project Structure

```
movie-tracker/
├── backend/           # Express API server
│   ├── server.js      # Entry point for the API
│   ├── db.js          # Database connection helper
│   ├── package.json   # Backend npm configuration
│   ├── .env.example   # Sample environment variables file
│   └── ...
├── database/
│   └── schema.sql     # SQL script to create tables
└── frontend/          # React application
    ├── package.json   # Frontend npm configuration
    ├── public/
    │   └── index.html # HTML template
    └── src/
        ├── App.js     # Root React component
        └── index.js   # React entry point
```
