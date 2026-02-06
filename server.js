const express = require('express');
const cors = require('cors');
const { writeFile, unlink } = require('fs/promises');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');

const execAsync = promisify(exec);
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Frontend serve karega

// ✅ API Route: Convert LaTeX to PDF
app.post('/generate-pdf', async (req, res) => {
    try {
        const { latex } = req.body;
        if (!latex) return res.status(400).json({ message: "LaTeX code is required" });

        const fileId = randomUUID();
        const tempDir = os.tmpdir();
        const inputPath = path.join(tempDir, `${fileId}.tex`);
        const outputPdfPath = path.join(tempDir, `${fileId}.pdf`);

        // 1. Write File
        await writeFile(inputPath, latex);
        console.log(`Compiling ${fileId}...`);

        // 2. Run Tectonic
        try {
            await execAsync(`tectonic -X compile "${inputPath}" --outdir "${tempDir}"`);
        } catch (e) {
            console.error("Compilation Failed:", e.stderr);
            return res.status(400).json({ 
                message: "Compilation Failed", 
                details: e.stderr 
            });
        }

        // 3. Send PDF
        res.contentType("application/pdf");
        res.sendFile(outputPdfPath, async (err) => {
            // Cleanup
            await unlink(inputPath).catch(() => {});
            await unlink(outputPdfPath).catch(() => {});
            if (err) console.error("Sending error:", err);
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Tectonic Engine running on port ${PORT}`));