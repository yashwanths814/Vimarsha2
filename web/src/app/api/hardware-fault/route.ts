import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const materialId: string | undefined = body.materialId;
    const componentType: string | undefined = body.componentType; // "erc" | "liner" | "sleeper"
    const condition: string | undefined = body.condition; // "ok" | "faulty" | "rust" | "missing"
    const confidence: number | undefined = body.confidence;
    const gps = body.gps as { lat?: number; lng?: number } | undefined;
    const detectedAtUnix: number | undefined = body.detectedAt;

    if (!materialId || !condition || !componentType) {
      return NextResponse.json(
        { ok: false, error: "materialId, componentType and condition are required" },
        { status: 400 }
      );
    }

    const detectedAtIso =
      detectedAtUnix != null
        ? new Date(detectedAtUnix * 1000).toISOString()
        : new Date().toISOString();

    const ref = doc(db, "materials", materialId);

    // Build human-readable AI status text
    const gpsText =
      gps?.lat != null && gps?.lng != null
        ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`
        : "not provided";

    const aiStatusBase =
      condition === "ok"
        ? `${componentType.toUpperCase()} appears OK (conf: ${
            confidence?.toFixed(2) ?? "n/a"
          })`
        : `${componentType.toUpperCase()} ${condition} detected (conf: ${
            confidence?.toFixed(2) ?? "n/a"
          })`;

    const aiStatus = `${aiStatusBase} at GPS: ${gpsText}`;

    // Build update object
    const updatePayload: Record<string, any> = {
      aiVerified: true,
      aiVerificationStatus: aiStatus,
      lastFaultHardwareGps: gps ?? null,
      lastFaultConfidence: confidence ?? null,
      lastFaultDetectedAt: detectedAtIso,
      componentType,
    };

    // If it's actually a fault (not OK), also mark fault fields
    if (condition !== "ok") {
      let faultType = "";
      let faultSeverity = "medium";

      if (condition === "missing") {
        faultType = `${componentType.toUpperCase()} missing`;
        faultSeverity = "critical";
      } else if (condition === "faulty") {
        faultType = `${componentType.toUpperCase()} faulty`;
        faultSeverity = "high";
      } else if (condition === "rust") {
        faultType = `${componentType.toUpperCase()} rust`;
        faultSeverity = "medium";
      }

      updatePayload.faultType = faultType;
      updatePayload.faultSeverity = faultSeverity;
      updatePayload.faultDetectedAt = detectedAtIso;
      updatePayload.faultSource = "hardware_auto";
      updatePayload.faultStatus = "pending_verification";
      updatePayload.maintenanceNotes = aiStatus;
    }

    await updateDoc(ref, updatePayload);

    return NextResponse.json(
      { ok: true, updatedMaterialId: materialId, aiStatus },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("hardware-fault API error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
