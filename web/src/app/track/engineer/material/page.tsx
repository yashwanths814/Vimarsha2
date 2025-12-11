"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/shared/firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import MainHeader from "@/components/Header";
import TrackSidebar from "@/components/TrackSidebar";

export default function EngineerMaterialPage() {
  const router = useRouter();

  // ID from query string (?id=XXXX)
  const [id, setId] = useState<string | null>(null);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // -------- Editable Fields --------
  const [lastMaintenanceDate, setLastMaintenanceDate] = useState("");
  const [engineerGpsLocation, setEngineerGpsLocation] = useState("");
  const [faultStatus, setFaultStatus] = useState("Open");

  const [engineerRemarks, setEngineerRemarks] = useState("");
  const [engineerRootCause, setEngineerRootCause] = useState("");
  const [engineerPreventiveAction, setEngineerPreventiveAction] = useState("");

  const [photoPreview, setPhotoPreview] = useState("");
  const [engineerPhotoData, setEngineerPhotoData] = useState("");

  // -------- Get ID from URL (client-only) + load material --------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const search = window.location.search;
    const params = new URLSearchParams(search);
    const materialId = params.get("id");

    if (!materialId) {
      setLoading(false);
      return;
    }

    setId(materialId);
    loadMaterial(materialId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMaterial(materialId: string) {
    try {
      setLoading(true);
      const snap = await getDoc(doc(db, "materials", materialId));

      if (!snap.exists()) {
        alert("Material not found");
        router.push("/track/engineer");
        return;
      }

      const m = snap.data();
      setData(m);

      // Prefill engineer fields
      setLastMaintenanceDate(m.lastMaintenanceDate || "");
      setEngineerGpsLocation(m.engineerGpsLocation || "");
      setFaultStatus(m.faultStatus || "Open");

      setEngineerRemarks(m.engineerRemarks || "");
      setEngineerRootCause(m.engineerRootCause || "");
      setEngineerPreventiveAction(m.engineerPreventiveAction || "");

      if (m.engineerPhotoData) {
        setEngineerPhotoData(m.engineerPhotoData);
        setPhotoPreview(m.engineerPhotoData);
      }
    } catch (err) {
      console.error("ENGINEER LOAD MATERIAL ERROR:", err);
      alert("Failed to load material details.");
      router.push("/track/engineer");
    } finally {
      setLoading(false);
    }
  }

  // ---------- File Upload (Base64) ----------
  function handleEngineerPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setEngineerPhotoData(base64);
      setPhotoPreview(base64);
    };
    reader.readAsDataURL(file);
  }

  // ---------- Auto Detect GPS ----------
  function detectEngineerGPS() {
    if (!navigator.geolocation) {
      alert("GPS not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = `${pos.coords.latitude.toFixed(
          6
        )}, ${pos.coords.longitude.toFixed(6)}`;
        setEngineerGpsLocation(loc);
      },
      () => alert("GPS permission denied")
    );
  }

  async function submitVerificationRequest() {
    if (!id) return;

    setSaving(true);

    try {
      await updateDoc(doc(db, "materials", id), {
        // Engineer final verification values
        lastMaintenanceDate,
        engineerGpsLocation,
        faultStatus,
        engineerRemarks,
        engineerRootCause,
        engineerPreventiveAction,
        engineerPhotoData: engineerPhotoData || null,

        // Send request to officer (only sending, NOT approving)
        requestStatus: "pending",
        engineerRequest: {
          submittedAt: new Date().toISOString(),
          lastMaintenanceDate,
          engineerGpsLocation,
          faultStatus,
          engineerRemarks,
          engineerRootCause,
          engineerPreventiveAction,
          engineerPhotoData,
        },
      });

      alert("Verification request submitted to Railway Officer!");
      router.push("/track/engineer");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ---------- LOADING UI ----------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F7E8FF] via-[#FDFBFF] to-[#E4D4FF] px-4">
        <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg px-6 py-4 flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-[#3A7AFF] animate-pulse" />
          <p className="text-sm font-medium text-gray-700">
            Loading material details…
          </p>
        </div>
      </div>
    );
  }

  if (!id || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F7E8FF] via-[#FDFBFF] to-[#E4D4FF] px-4">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg px-6 py-4 text-center">
          <p className="text-sm font-medium text-red-600">
            Material details not available.
          </p>
          <button
            onClick={() => router.push("/track/engineer")}
            className="mt-3 text-xs text-[#A259FF] hover:underline"
          >
            ← Back to Engineer Dashboard
          </button>
        </div>
      </div>
    );
  }

  const m = data;

  // Optional: format AI verified date if present
  let aiVerifiedText: string | null = null;
  if (m.aiVerifiedAt) {
    try {
      const d = new Date(m.aiVerifiedAt);
      aiVerifiedText = d.toLocaleString();
    } catch {
      aiVerifiedText = m.aiVerifiedAt;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E8FF] via-[#FDFBFF] to-[#E4D4FF] flex flex-col">
      <MainHeader />

      <div className="flex pt-[90px] flex-col lg:flex-row">
        {/* Sidebar only on large screens */}
        <div className="hidden lg:block">
          <TrackSidebar />
        </div>

        {/* ================= MAIN CONTENT ================ */}
        <main className="w-full lg:ml-64 lg:w-[calc(100%-16rem)] px-4 sm:px-6 lg:px-10 pb-10">
          <div className="max-w-5xl mx-auto space-y-7">
            {/* TOP CARD */}
            <div className="mb-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-[#4B3A7A] tracking-tight">
                  Engineer Material View
                </h1>
                <p className="mt-1 text-xs md:text-sm text-gray-600">
                  Review installation, fault details, AI classification and update
                  verification.
                </p>
              </div>

              <div className="inline-flex items-center gap-3 rounded-2xl bg-white/70 backdrop-blur px-4 py-2 shadow-sm border border-purple-100 w-full sm:w-auto justify-between sm:justify-start">
                <span className="text-[10px] uppercase tracking-wide text-gray-500">
                  Material ID
                </span>
                <span className="text-xs font-semibold text-[#A259FF]">
                  {m.materialId}
                </span>
              </div>
            </div>

            {/* MAIN CARD */}
            <div className="bg-white/90 backdrop-blur rounded-3xl shadow-xl border border-purple-100/70 p-4 sm:p-5 md:p-7 space-y-7 text-xs md:text-sm">
              {/* ---------- SECTION 1 ---------- */}
              <SectionHeader num="1" title="Manufacturer Details" readOnly />
              <p className="text-[11px] text-gray-500 mb-4">
                Core manufacturer specification and procurement details.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <InfoField label="Material ID" value={m.materialId} />
                <InfoField label="Fitting Type" value={m.fittingType} />
                <InfoField label="Drawing Number" value={m.drawingNumber} />
                <InfoField label="Material Spec" value={m.materialSpec} />
                <InfoField label="Weight (kg)" value={m.weightKg} />
                <InfoField label="Board Gauge" value={m.boardGauge} />
                <InfoField label="Manufacturing Date" value={m.manufacturingDate} />
                <InfoField
                  label="Expected Service Life"
                  value={m.expectedLifeYears}
                />
                <InfoField
                  label="Purchase Order Number"
                  value={m.purchaseOrderNumber}
                />
                <InfoField label="Batch Number" value={m.batchNumber} />
                <InfoField label="Depot Code" value={m.depotCode} />
                <InfoField label="UDM Lot Number" value={m.udmLotNumber} />
              </div>

              <DividerPurple />

              {/* ---------- SECTION 2 ---------- */}
              <SectionHeader num="2" title="Installation Snapshot (Track Staff)" />
              <p className="text-[11px] text-gray-500 mb-4">
                Details entered by field installation staff.
              </p>

              <div className="grid md:grid-cols-2 gap-4 mb-3">
                <InfoField label="Depot Entry Date" value={m.depotEntryDate} />
                <InfoField label="TMS Track ID" value={m.tmsTrackId} />
                <InfoField
                  label="Installation Status"
                  value={m.installationStatus}
                />
                <InfoField
                  label="GPS Installation Location"
                  value={m.gpsLocation}
                />
              </div>

              {/* 🔍 AI VERIFIED COMPONENT FROM INSTALLATION MODULE */}
              {(m.aiVerifiedComponent || typeof m.aiVerifiedConfidence === "number") && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-medium text-gray-600">
                    AI Verification (Installation):
                  </span>
                  {m.aiVerifiedComponent ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-[11px] font-semibold text-green-800 border border-green-200">
                      {m.aiVerifiedComponent.toUpperCase()}{" "}
                      {typeof m.aiVerifiedConfidence === "number" && (
                        <span className="ml-1 text-[10px] font-normal">
                          ({m.aiVerifiedConfidence.toFixed(2)})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-100 text-[11px] font-semibold text-yellow-800 border border-yellow-200">
                      No clear component detected by AI
                    </span>
                  )}

                  {aiVerifiedText && (
                    <span className="text-[10px] text-gray-400">
                      at {aiVerifiedText}
                    </span>
                  )}
                </div>
              )}

              {m.jioTagPhotoData && (
                <PhotoBlock label="Jio Tag Photo" src={m.jioTagPhotoData} />
              )}

              <DividerRed />

              {/* ---------- SECTION 3 ---------- */}
              <SectionHeader num="3" title="Fault & Detection Details" red />
              <p className="text-[11px] text-gray-500 mb-4">
                Snapshot of anomaly detected by hardware or Druva vehicle.
              </p>

              <div className="grid md:grid-cols-2 gap-4 mb-3">
                <InfoField label="Fault Type" value={m.faultType || "—"} />
                <InfoField label="Fault Severity" value={m.faultSeverity || "—"} />
                <InfoField
                  label="Fault Detected At"
                  value={m.faultDetectedAt || "—"}
                />
                <InfoField
                  label="Detection Source"
                  value={m.faultSource || "Hardware / Druva"}
                />
              </div>

              <TextAreaBlock
                label="Maintenance Staff Notes"
                value={m.maintenanceNotes}
              />

              <DividerGreen />

              {/* ---------- SECTION 4: ENGINEER EDITABLE ---------- */}
              <SectionHeader
                num="4"
                title="Engineer Verification & Closure"
                green
              />
              <p className="text-[11px] text-gray-500 mb-4">
                Enter verification details after site visit and repairs.
              </p>

              <div className="grid md:grid-cols-2 gap-4 mb-3">
                {/* Last maintenance date */}
                <EditableField label="Last Maintenance Date (Engineer Confirmed)">
                  <input
                    type="date"
                    value={lastMaintenanceDate}
                    onChange={(e) => setLastMaintenanceDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#A259FF]/40"
                  />
                </EditableField>

                {/* GPS */}
                <EditableField label="Engineer GPS (During Visit)">
                  <div className="flex gap-2">
                    <input
                      value={engineerGpsLocation}
                      onChange={(e) => setEngineerGpsLocation(e.target.value)}
                      className="flex-grow px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#A259FF]/40"
                      placeholder="Latitude, Longitude"
                    />
                    <button
                      type="button"
                      onClick={detectEngineerGPS}
                      className="px-3 py-2 bg-green-600 text-white rounded-xl text-xs hover:bg-green-700"
                    >
                      Detect
                    </button>
                  </div>
                </EditableField>

                {/* Fault status */}
                <EditableField label="Fault Status">
                  <select
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#A259FF]/40"
                    value={faultStatus}
                    onChange={(e) => setFaultStatus(e.target.value)}
                  >
                    <option>Open</option>
                    <option>Closed</option>
                    <option>Repaired</option>
                    <option>Pending Parts</option>
                  </select>
                </EditableField>
              </div>

              {/* Remarks */}
              <EditableTextArea
                label="Engineer Remarks"
                value={engineerRemarks}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setEngineerRemarks(e.target.value)
                }
              />

              <EditableTextArea
                label="Root Cause (Diagnosis)"
                value={engineerRootCause}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setEngineerRootCause(e.target.value)
                }
              />

              <EditableTextArea
                label="Preventive Measures"
                value={engineerPreventiveAction}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setEngineerPreventiveAction(e.target.value)
                }
              />

              {/* Photo Upload */}
              <div className="mt-3 space-y-1">
                <p className="text-[11px] font-medium text-gray-700">
                  Engineer Visit Photo
                </p>

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleEngineerPhoto}
                  className="text-xs"
                />

                {photoPreview && (
                  <div className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden inline-block bg-gray-50 mt-2">
                    <img
                      src={photoPreview}
                      className="w-32 h-32 md:w-40 md:h-40 object-cover"
                      alt="Engineer visit preview"
                    />
                  </div>
                )}
              </div>

              {/* SUBMIT BUTTON */}
              <button
                onClick={submitVerificationRequest}
                disabled={saving}
                className="mt-4 w-full py-3 rounded-2xl bg-[#3A7AFF] text-white font-semibold text-sm shadow hover:bg-[#2A6AEF] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {saving
                  ? "Submitting..."
                  : "Submit Verification Request to Railway Officer"}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ---------- Helper UI Components ---------- */

function SectionHeader({
  num,
  title,
  readOnly,
  red,
  green,
}: {
  num: string;
  title: string;
  readOnly?: boolean;
  red?: boolean;
  green?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h2
        className={`text-sm md:text-base font-semibold flex items-center gap-2 ${
          red ? "text-red-700" : green ? "text-green-800" : "text-[#4B3A7A]"
        }`}
      >
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold
          ${
            red
              ? "bg-red-100 text-red-700"
              : green
              ? "bg-green-100 text-green-800"
              : "bg-[#F7E8FF] text-[#A259FF]"
          }`}
        >
          {num}
        </span>
        {title}
      </h2>

      {readOnly && (
        <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-3 py-1">
          Read Only
        </span>
      )}
    </div>
  );
}

function DividerPurple() {
  return <div className="border-t border-dashed border-purple-100" />;
}

function DividerRed() {
  return <div className="border-t border-dashed border-red-200" />;
}

function DividerGreen() {
  return <div className="border-t border-dashed border-green-200" />;
}

function InfoField({ label, value }: { label: string; value: any }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium text-gray-600">{label}</p>
      <p className="text-xs font-semibold text-gray-900">{value || "—"}</p>
    </div>
  );
}

function TextAreaBlock({ label, value }: { label: string; value: any }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-gray-700">{label}</p>
      <textarea
        readOnly
        className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-[11px] text-gray-800"
        rows={3}
        value={value || "—"}
      />
    </div>
  );
}

function EditableField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-gray-700">{label}</p>
      {children}
    </div>
  );
}

function EditableTextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-gray-700">{label}</p>
      <textarea
        className="w-full px-3 py-2 rounded-xl border bg-white border-gray-300 text-[11px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#A259FF]/40"
        rows={3}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function PhotoBlock({ label, src }: { label: string; src: string }) {
  return (
    <div className="mt-3">
      <p className="text-[11px] font-medium text-gray-700 mb-1">{label}</p>
      <div className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden inline-block bg-gray-50">
        <img
          src={src}
          className="w-32 h-32 md:w-40 md:h-40 object-cover"
          alt={label}
        />
      </div>
    </div>
  );
}
