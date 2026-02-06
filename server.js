require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { writeFile, unlink } = require('fs/promises');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const execAsync = promisify(exec);
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ✅ SETUP GEMINI
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR: GEMINI_API_KEY is missing in .env file");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1️⃣ Route: AI Resume Writer (Gemini)
app.post('/generate-latex', async (req, res) => {
    try {
        const { currentResume, jobDescription } = req.body;
        
        if (!currentResume || !jobDescription) {
            return res.status(400).json({ message: "Resume and JD are required" });
        }

        // 👇👇 CHANGE IS HERE: "gemini-pro" -> "gemini-1.5-flash" 👇👇
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const prompt = `
        You are an expert ATS Resume Writer and LaTeX Developer.
        
        TASK:
        Rewrite the provided RESUME content to perfectly match the JOB DESCRIPTION.
        Output valid, compilable LaTeX code.
        
        CRITICAL RULES (Follow Strictly):
        1. Use the standard 'article' class.
        2. DO NOT use custom commands like \\resumeItem, \\cventry, or \\resumeSubheading. 
        3. Use standard LaTeX commands ONLY: \\section{}, \\textbf{}, \\textit{}, \\begin{itemize} ... \\end{itemize}.
        4. Ensure every opening bracket '{' has a closing bracket '}'.
        5. Do not leave the code incomplete.
        6. NO Markdown blocks (return raw code).

        RESUME INPUT:
        ${currentResume}

        JOB DESCRIPTION:
        ${jobDescription}
        `;

        console.log("🤖 Asking Gemini to write resume...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let latexCode = response.text();

        // Cleanup: Markdown hatana
        latexCode = latexCode.replace(/```latex/g, "").replace(/```/g, "").trim();

        console.log("✅ AI Generation Complete");
        res.json({ latex: latexCode });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ message: "AI generation failed", error: error.message });
    }
});

// 2️⃣ Route: Convert LaTeX to PDF (Tectonic)
app.post('/generate-pdf', async (req, res) => {
    try {
        const { latex } = req.body;
        if (!latex) return res.status(400).json({ message: "LaTeX code is required" });

        const fileId = randomUUID();
        const tempDir = os.tmpdir();
        const inputPath = path.join(tempDir, `${fileId}.tex`);
        const outputPdfPath = path.join(tempDir, `${fileId}.pdf`);

        await writeFile(inputPath, latex);
        
        try {
            // Windows vs Linux check
            const cmd = process.platform === 'win32' ? '.\\tectonic.exe' : 'tectonic';
            await execAsync(`${cmd} -X compile "${inputPath}" --outdir "${tempDir}"`);
        } catch (e) {
            console.error("Tectonic Error:", e.stderr);
            return res.status(400).json({ message: "Compilation Failed", details: e.stderr });
        }

        res.contentType("application/pdf");
        res.sendFile(outputPdfPath, async (err) => {
            await unlink(inputPath).catch(() => {});
            await unlink(outputPdfPath).catch(() => {});
        });

    } catch (error) {
        console.error("PDF Route Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 AI + PDF Engine running on port ${PORT}`));