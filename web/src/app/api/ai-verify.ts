import { NextApiRequest, NextApiResponse } from "next";
import { spawn } from "child_process";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Only POST allowed" });

  const { base64Image, materialId } = req.body;

  if (!base64Image)
    return res.status(400).json({ error: "base64Image missing" });

  // Save the base64 image to temp file
  const tempPath = "/tmp/verify.jpg";
  const imageBuffer = Buffer.from(base64Image.split(",")[1], "base64");
  require("fs").writeFileSync(tempPath, imageBuffer);

  // Run YOLO Python script
  const py = spawn("python", ["verify_single_image.py", tempPath, materialId]);

  let output = "";
  py.stdout.on("data", (data) => (output += data.toString()));
  py.stderr.on("data", (data) => console.error("PY ERR:", data.toString()));

  py.on("close", () => {
    try {
      const result = JSON.parse(output);
      res.status(200).json(result);
    } catch {
      res.status(500).json({ error: "Invalid YOLO output" });
    }
  });
}
