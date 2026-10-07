import prisma from "../config/db.js";

// A stalled pool should fail the check quickly rather than hang the probe.
const DB_PING_TIMEOUT_MS = 3000;

function pingDatabase() {
    let timer;

    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Database ping timed out")), DB_PING_TIMEOUT_MS);
    });

    return Promise.race([prisma.$queryRaw`SELECT 1`, timeout]).finally(() => clearTimeout(timer));
}

// Healthy only when the database answers; failures are logged, not returned.
export async function getHealth(req, res) {
    const timestamp = new Date().toISOString();

    try {
        await pingDatabase();
    } catch (err) {
        console.error("Health check failed:", err);

        return res.status(503).json({
            success: false,
            status: "unavailable",
            database: "unreachable",
            timestamp,
        });
    }

    res.json({
        success: true,
        status: "ok",
        database: "ok",
        timestamp,
    });
}
