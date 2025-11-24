# Deploying to Render.com

This guide explains how to deploy your Order Management System to Render.com with a PostgreSQL database.

## Prerequisites

1.  **GitHub Account**: You need a GitHub account to host your code.
2.  **Render Account**: Sign up at [render.com](https://render.com).

## Step 1: Push Code to GitHub

1.  Create a new repository on GitHub.
2.  Push your project code to this repository.

## Step 2: Create PostgreSQL Database on Render

1.  Log in to your Render Dashboard.
2.  Click **New +** and select **PostgreSQL**.
3.  **Name**: Give it a name (e.g., `orders-db`).
4.  **Region**: Choose a region close to you (e.g., Frankfurt or Oregon).
5.  **Instance Type**: Select **Free**.
6.  Click **Create Database**.
7.  Wait for it to be created.
8.  **Copy the Internal DB URL**: Look for the `Internal Database URL` (starts with `postgres://...`). You will need this later.
    *   *Note: If you plan to connect from your local machine for testing, use the External Database URL, but for the Web Service, Internal is faster and secure.*

## Step 3: Create Web Service on Render

1.  Go back to the Dashboard.
2.  Click **New +** and select **Web Service**.
3.  **Connect GitHub**: Connect your GitHub account and select your repository.
4.  **Name**: Give your service a name (e.g., `my-order-system`).
5.  **Region**: Choose the **SAME region** as your database.
6.  **Branch**: `main` (or master).
7.  **Root Directory**: Leave empty (defaults to root).
8.  **Runtime**: **Node**.
9.  **Build Command**: `npm install`
10. **Start Command**: `node server.js`
11. **Instance Type**: Select **Free**.

## Step 4: Configure Environment Variables

1.  Scroll down to the **Environment Variables** section (or go to the "Environment" tab after creation).
2.  Add the following variables:

    *   **Key**: `DATABASE_URL`
    *   **Value**: Paste the **Internal Database URL** you copied from the database step.

    *   **Key**: `SESSION_SECRET`
    *   **Value**: A long random string (e.g., `super-secret-key-12345`).

    *   **Key**: `NODE_ENV`
    *   **Value**: `production`

3.  Click **Create Web Service** (or Save Changes).

## Step 5: Database Initialization

The application is configured to automatically create the necessary tables (`users`, `orders_temp`, `archive`, `session`) and the default admin user when it starts for the first time.

You do **not** need to run a manual migration script. Just wait for the deployment to finish.

## Step 6: Access Your App

1.  Once the deployment is marked as **Live**, you will see a URL (e.g., `https://my-order-system.onrender.com`).
2.  Click the URL to open your app.
3.  **Page 1** is public.
4.  **Page 2** and **Page 3** require login.
    *   **Default Username**: `admin`
    *   **Default Password**: `admin123`

## Troubleshooting

*   **Logs**: If something goes wrong, check the **Logs** tab in Render.
*   **Database Connection**: Ensure `DATABASE_URL` is correct and the Web Service is in the same region as the Database.
