"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/shared/firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import MainHeader from "@/components/Header";
import TrackSidebar from "@/components/TrackSidebar";

export default function InstallationMaterialPage() {
  const router = useRouter();

  // ID from ?id=... in URL (client-only)
  const [id, setId] = useState<string | null>(null);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Installation-Editable Fields
  const [depotEntryDate, setDepotEntryDate] = useState("");
  const [tmsTrackId, setTmsTrackId] = useState("");
  const [gpsLocation, setGpsLocation] = useState("");
  const [installationStatus, setInstallationStatus] = useState("Not Installed");

  // Jio Tag Photo (base64)
  const [jioTagPreview, setJioTagPreview] = useState("");
  const [jioTagPhotoData, setJioTagPhotoData] = useState<string>("");

  // 🔍 AI Verification state
  const [aiStatus, setAiStatus] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [aiComponent, setAiComponent] = useState<string | null>(null);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // -----------------------------
  // Get id from URL & load Firestore
  // -----------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const materialId = params.get("id");

    if (!materialId) {
      setLoading(false);
      return;
    }

    setId(materialId);
    loadMaterial(materialId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // LOAD FIRESTORE MATERIAL DATA
  // -----------------------------
  async function loadMaterial(materialId: string) {
    try {
      setLoading(true);
      const snap = await getDoc(doc(db, "materials", materialId));

      if (!snap.exists()) {
        alert("Material not found");
        router.push("/track/installation");
        return;
      }

      const d = snap.data();
      setData(d);

      // Prefill editable fields
      setDepotEntryDate(d.depotEntryDate || "");
      setTmsTrackId(d.tmsTrackId || "");
      setGpsLocation(d.gpsLocation || "");
      setInstallationStatus(d.installationStatus || "Not Installed");

      // Load existing Jio tag base64 image if present
      if (d.jioTagPhotoData) {
        setJioTagPhotoData(d.jioTagPhotoData);
        setJioTagPreview(d.jioTagPhotoData);
      }

      // Prefill AI result if already there
      if (d.aiVerifiedComponent) {
        setAiComponent(d.aiVerifiedComponent);
        setAiStatus("done");
      }
      if (typeof d.aiVerifiedConfidence === "number") {
        setAiConfidence(d.aiVerifiedConfidence);
      }
    } catch (err) {
      console.error("LOAD MATERIAL ERROR:", err);
      alert("Failed to load material details.");
      router.push("/track/installation");
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------
  // Handle Jio Tag Photo (Base64)
  // -----------------------------
  function handleJioTagPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      const base64 = reader.result as string;
      setJioTagPhotoData(base64);
      setJioTagPreview(base64);

      // Reset AI state when a new image is chosen
      setAiStatus("idle");
      setAiComponent(null);
      setAiConfidence(null);
      setAiError(null);
    };

    reader.readAsDataURL(file);
  }

  // -----------------------------
  // GPS AUTO DETECT
  // -----------------------------
  function detectLocation() {
    if (!navigator.geolocation) {
      alert("GPS not supported on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = `${pos.coords.latitude.toFixed(
          6
        )}, ${pos.coords.longitude.toFixed(6)}`;
        setGpsLocation(loc);
      },
      () => alert("GPS permission denied or unavailable")
    );
  }

  // -----------------------------
  // 🔍 RUN AI VERIFICATION (Render URL)
  // -----------------------------
  async function runAiVerification() {
    if (!id) {
      alert("Material ID missing in URL.");
      return;
    }

    if (!jioTagPhotoData) {
      alert("Please upload the Jio Tag photo first.");
      return;
    }

    try {
      setAiStatus("running");
      setAiError(null);

      const res = await fetch(
        "https://railclassification-3.onrender.com/api/verify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_base64: jioTagPhotoData, // full data URL
          }),
        }
      );

      const json = await res.json();

      if (!json.ok) {
        console.error("AI verify error:", json.error);
        setAiStatus("error");
        setAiError(json.error || "AI verification failed");
        return;
      }

      const comp: string | null = json.component;
      const conf: number = json.confidence ?? 0;

      setAiComponent(comp);
      setAiConfidence(conf);
      setAiStatus("done");

      // 🔥 Store AI result for Engineer module
      await updateDoc(doc(db, "materials", id), {
        depotEntryDate,
        tmsTrackId,
        gpsLocation,
        installationStatus,
        jioTagPhotoData: jioTagPhotoData || null,
        aiVerifiedComponent: comp,
        aiVerifiedConfidence: conf,
        aiVerifiedAt: new Date().toISOString(),
      });

      // Mirror into local data for immediate UI update
      setData((prev: any) => ({
        ...prev,
        depotEntryDate,
        tmsTrackId,
        gpsLocation,
        installationStatus,
        jioTagPhotoData,
        aiVerifiedComponent: comp,
        aiVerifiedConfidence: conf,
        aiVerifiedAt: new Date().toISOString(),
      }));
    } catch (err: any) {
      console.error("AI verify exception:", err);
      setAiStatus("error");
      setAiError(err.message || "Network error while calling AI server");
    }
  }

  // -----------------------------
  // SAVE INSTALLATION UPDATES (manual save button)
  // -----------------------------
  async function saveUpdates() {
    if (!id) return;

    setSaving(true);

    try {
      await updateDoc(doc(db, "materials", id), {
        depotEntryDate,
        tmsTrackId,
        gpsLocation,
        installationStatus,
        jioTagPhotoData: jioTagPhotoData || null,
      });

      setData((prev: any) => ({
        ...prev,
        depotEntryDate,
        tmsTrackId,
        gpsLocation,
        installationStatus,
        jioTagPhotoData,
      }));

      alert("Installation details updated successfully");
      router.push("/track/installation");
    } catch (err: any) {
      console.error("SAVE ERROR:", err);

      if (err?.code) {
        alert(`Failed: ${err.code}`);
      } else if (err?.message) {
        alert(`Failed: ${err.message}`);
      } else {
        alert("Failed to save installation details.");
      }
    } finally {
      setSaving(false);
    }
  }

  // -----------------------------
  // UI STATES
  // -----------------------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F7E8FF] via-[#FDFBFF] to-[#E4D4FF]">
        <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg px-6 py-4 flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-[#A259FF] animate-pulse" />
          <p className="text-sm font-medium text-gray-700">
            Loading material details…
          </p>
        </div>
      </div>
    );
  }

  // If no data (no id or failed to load but not redirected yet)
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F7E8FF] via-[#FDFBFF] to-[#E4D4FF] px-4">
        <div className="bg-white/90 shadow-md px-5 py-4 rounded-2xl text-center">
          <p className="text-sm font-medium text-red-600">
            Material details not available.
          </p>
          <button
            onClick={() => router.push("/track/installation")}
            className="mt-3 text-xs text-[#A259FF] hover:underline"
          >
            ← Back to Installation Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E8FF] via-[#FDFBFF] to-[#E4D4FF]">
      {/* Top header */}
      <MainHeader />

      <div className="flex pt-[90px]">
        {/* Sidebar: hidden on mobile, visible on large screens */}
        <div className="hidden lg:block">
          <TrackSidebar />
        </div>

        {/* MAIN CONTENT */}
        <main
          className="
            w-full
            px-4 pb-10
            lg:ml-64 lg:w:[calc(100%-16rem)] lg:px-10
          "
        >
          <div className="max-w-5xl mx-auto">
            {/* Mobile Back + Title Row */}
            <div className="mb-4 lg:hidden flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-white/80 text-xs font-medium text-[#A259FF] shadow-sm border border-purple-100"
              >
                ← Back
              </button>
              <span className="text-[11px] text-gray-500">
                Installation Update
              </span>
            </div>

            {/* Top Header Card */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-3xl font-extrabold text-[#4B3A7A] tracking-tight">
                  Material Installation Update
                </h1>
                <p className="mt-1 text-xs md:text-sm text-gray-600">
                  Review manufacturer details and update installation information
                  from the field.
                </p>
              </div>

              {data?.materialId && (
                <div className="inline-flex items-center gap-3 rounded-2xl bg-white/70 backdrop-blur px-3 py-2 shadow-sm border border-purple-100">
                  <span className="text-[10px] uppercase tracking-wide text-gray-500">
                    Material ID
                  </span>
                  <span className="text-xs font-semibold text-[#A259FF]">
                    {data.materialId}
                  </span>
                </div>
              )}
            </div>

            {/* Main Card */}
            <div className="bg-white/90 backdrop-blur rounded-3xl shadow-xl border border-purple-100/70 p-4 md:p-7 space-y-7 text-xs md:text-sm">
              {/* SECTION 1: Manufacturer Details */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm md:text-base font-semibold text-[#4B3A7A] flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#F7E8FF] text-[11px] font-bold text-[#A259FF]">
                      1
                    </span>
                    Manufacturer Details
                  </h2>
                  <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-3 py-1">
                    Read Only
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mb-4">
                  These details are provided by the manufacturer and cannot be edited
                  from this screen.
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Row 1 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-600">
                      Material ID
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-xs"
                      readOnly
                      value={data.materialId}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-600">
                      Fitting Type
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-xs"
                      readOnly
                      value={data.fittingType}
                    />
                  </div>

                  {/* Row 2 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-600">
                      Drawing Number
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-xs"
                      readOnly
                      value={data.drawingNumber}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-600">
                      Material Spec
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-xs"
                      readOnly
                      value={data.materialSpec}
                    />
                  </div>

                  {/* Row 3 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-600">
                      Weight (kg)
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-xs"
                      readOnly
                      value={data.weightKg}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-600">
                      Board Gauge
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-xs"
                      readOnly
                      value={data.boardGauge}
                    />
                  </div>

                  {/* Row 4 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-600">
                      Manufacturing Date
                    </label>
                    <input
                      type="date"
                      readOnly
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-xs"
                      value={data.manufacturingDate}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-600">
                      Expected Service Life (years)
                    </label>
                    <input
                      readOnly
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-xs"
                      value={data.expectedLifeYears}
                    />
                  </div>

                  {/* Row 5 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-600">
                      Purchase Order Number
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-xs"
                      readOnly
                      value={data.purchaseOrderNumber}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-600">
                      Batch Number
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-xs"
                      readOnly
                      value={data.batchNumber}
                    />
                  </div>

                  {/* Row 6 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-600">
                      Depot Code
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-xs"
                      readOnly
                      value={data.depotCode}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-600">
                      UDM Lot Number
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-xs"
                      readOnly
                      value={data.udmLotNumber}
                    />
                  </div>
                </div>
              </section>

              <div className="border-t border-dashed border-purple-100" />

              {/* SECTION 2: Installation Details */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm md:text-base font-semibold text-[#4B3A7A] flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#E4D4FF] text-[11px] font-bold text-[#4B3A7A]">
                      2
                    </span>
                    Installation Details
                  </h2>
                  <span className="text-[10px] uppercase tracking-wide text-[#A259FF] bg-[#F7E8FF] border border-[#E4D4FF] rounded-full px-3 py-1">
                    Field Editable
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mb-4">
                  Update depot entry, track information and on-site installation
                  details. Ensure GPS and Jio Tag image match the installed location.
                </p>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-700">
                      Depot Entry Date
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#A259FF]/50 text-xs"
                      value={depotEntryDate}
                      onChange={(e) => setDepotEntryDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-700">
                      TMS Track ID
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#A259FF]/50 text-xs"
                      value={tmsTrackId}
                      onChange={(e) => setTmsTrackId(e.target.value)}
                    />
                  </div>
                </div>

                {/* GPS DETECT */}
                <div className="mb-4 space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-700">
                    GPS Installation Location
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      className="flex-grow px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#A259FF]/50 text-xs"
                      placeholder="Latitude, Longitude"
                      value={gpsLocation}
                      onChange={(e) => setGpsLocation(e.target.value)}
                    />
                    <button
                      onClick={detectLocation}
                      type="button"
                      className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#A259FF] text-white text-xs font-medium shadow hover:bg-[#8E3FE8] transition-colors"
                    >
                      Detect GPS
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Tip: Use the “Detect GPS” button when standing near the installed
                    material for accurate coordinates.
                  </p>
                </div>

                {/* Installation Status */}
                <div className="mb-4 space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-700">
                    Installation Status
                  </label>
                  <select
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#A259FF]/50 text-xs"
                    value={installationStatus}
                    onChange={(e) => setInstallationStatus(e.target.value)}
                  >
                    <option>Not Installed</option>
                    <option>Installed</option>
                  </select>
                </div>

                {/* Jio Tag Photo + AI Verification */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-gray-700">
                    Jio Tag Photo
                  </label>
                  <div className="flex flex-col md:flex-row gap-4 md:items-start">
                    <div className="flex-1 space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleJioTagPhoto}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#A259FF] file:text-white file:text-[11px] hover:file:bg-[#8E3FE8] cursor-pointer"
                      />
                      <p className="mt-1 text-[10px] text-gray-400">
                        Upload a clear photo of the installed Jio tag showing the
                        ID and surrounding track area.
                      </p>

                      {/* 🔍 AI verification button + status */}
                      <div className="mt-2 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                        <button
                          type="button"
                          onClick={runAiVerification}
                          disabled={!jioTagPhotoData || aiStatus === "running"}
                          className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#3A7AFF] text-white text-xs font-semibold shadow disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {aiStatus === "running"
                            ? "Running AI Verification…"
                            : "Run AI Verification"}
                        </button>

                        {aiStatus === "done" && aiComponent && (
                          <span className="text-[11px] px-3 py-1 rounded-full bg-green-100 text-green-800">
                            AI Verified: {aiComponent.toUpperCase()}(
                            {aiConfidence?.toFixed(2)})
                          </span>
                        )}

                        {aiStatus === "done" && !aiComponent && (
                          <span className="text-[11px] px-3 py-1 rounded-full bg-yellow-100 text-yellow-800">
                            AI could not detect any component.
                          </span>
                        )}

                        {aiStatus === "error" && (
                          <span className="text-[11px] px-3 py-1 rounded-full bg-red-100 text-red-800">
                            AI Error: {aiError}
                          </span>
                        )}
                      </div>
                    </div>

                    {jioTagPreview && (
                      <div className="flex flex-col items-center gap-1">
                        <div className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                          <img
                            src={jioTagPreview}
                            className="w-32 h-32 md:w-40 md:h-40 object-cover"
                            alt="Jio Tag Preview"
                          />
                        </div>
                        <span className="text-[10px] text-gray-500">
                          Current Jio Tag Photo
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Footer Save Button */}
              <div className="pt-2">
                <button
                  onClick={saveUpdates}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 md:py-3 rounded-2xl bg-[#A259FF] text-white font-semibold text-sm shadow-md hover:bg-[#8E3FE8] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {saving && (
                    <span className="h-3 w-3 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
                  )}
                  {saving
                    ? "Saving Installation Details…"
                    : "Save Installation Details"}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
