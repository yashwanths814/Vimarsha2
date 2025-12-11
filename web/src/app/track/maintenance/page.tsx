"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { auth, db } from "@/shared/firebaseConfig";
import MainHeader from "@/components/Header";
import TrackSidebar from "@/components/TrackSidebar";

export default function MaintenanceDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [druva, setDruva] = useState<any>(null);
  const [faults, setFaults] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/track/login");
        return;
      }

      // optional: ensure this user is maintenance staff
      const staffSnap = await getDoc(doc(db, "trackStaff", user.uid));
      const role = staffSnap.exists() ? staffSnap.data().role : null;

      if (role !== "maintenance") {
        router.push("/track/login");
        return;
      }

      await loadData(user.uid);
    });

    return () => unsub();
  }, []);

  async function loadData(userId: string) {
    setLoading(true);

    // Load Druva status
    const s = await getDoc(doc(db, "druvaStatus", "vehicle-1"));
    if (s.exists()) setDruva(s.data());

    // Load faults
    const q1 = query(
      collection(db, "faults"),
      where("status", "==", "open")
    );
    const snapFaults = await getDocs(q1);
    setFaults(snapFaults.docs.map((d) => ({ id: d.id, ...d.data() })));

    // Load tasks
    const q2 = query(
      collection(db, "maintenanceTasks"),
      where("assignedTo", "==", userId),
      where("status", "==", "pending")
    );
    const snapTasks = await getDocs(q2);
    setTasks(snapTasks.docs.map((d) => ({ id: d.id, ...d.data() })));

    // Load activity
    const q3 = query(
      collection(db, "maintenanceActivity"),
      orderBy("createdAt", "desc")
    );
    const snapAct = await getDocs(q3);
    setActivity(
      snapAct.docs.map((d) => ({ id: d.id, ...d.data() })).slice(0, 10)
    );

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7E8FF]">
        <div className="h-10 w-10 border-4 border-[#A259FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const openCritical = faults.filter((f) => f.severity === "critical").length;
  const openMedium = faults.filter((f) => f.severity === "medium").length;
  const openLow = faults.filter((f) => f.severity === "low").length;

  return (
    <div className="min-h-screen flex bg-[#F7E8FF]">
      <TrackSidebar />

      <main className="flex-1 ml-64 p-4 sm:p-6">
        <MainHeader title="Maintenance Dashboard" />

        {/* Top cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* Druva Status */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="text-sm font-semibold text-gray-600">
              Druva Vehicle Status
            </h2>
            <p className="mt-1 text-xl font-bold text-[#A259FF]">
              {druva?.status || "Unknown"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Battery: {druva?.batteryHealth ?? "--"}% • Motor:{" "}
              {druva?.motorHealth ?? "--"}%
            </p>
          </div>

          {/* Open Faults */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="text-sm font-semibold text-gray-600">
              Open Faults
            </h2>
            <p className="mt-1 text-2xl font-extrabold text-[#E05F5F]">
              {faults.length}
            </p>
            <div className="mt-1 flex gap-3 text-[11px] text-gray-600">
              <span>Critical: {openCritical}</span>
              <span>Medium: {openMedium}</span>
              <span>Low: {openLow}</span>
            </div>
          </div>

          {/* Today’s Tasks */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="text-sm font-semibold text-gray-600">
              Today&apos;s Tasks
            </h2>
            <p className="mt-1 text-2xl font-extrabold text-[#6B4FA3]">
              {tasks.length}
            </p>
            <ul className="mt-2 max-h-20 overflow-y-auto text-[11px] text-gray-600">
              {tasks.length === 0 ? (
                <li className="text-gray-400">No pending tasks 🎉</li>
              ) : (
                tasks.map((t) => <li key={t.id}>• {t.title}</li>)
              )}
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* Recent Activity */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow p-4">
            <h2 className="text-sm font-semibold text-gray-600 mb-2">
              Recent Activity
            </h2>
            <ul className="max-h-64 overflow-y-auto text-[11px] space-y-2">
              {activity.length === 0 ? (
                <li className="text-gray-400">No activity logged yet.</li>
              ) : (
                activity.map((a) => (
                  <li
                    key={a.id}
                    className="border-b last:border-b-0 pb-1 text-gray-700"
                  >
                    {a.action}
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-600 mb-1">
              Quick Actions
            </h2>

            <button
              onClick={() => router.push("/track/component-failure/new")}
              className="py-2 rounded-xl bg-[#A259FF] text-white text-sm font-semibold shadow"
            >
              ➕ Log Component Failure
            </button>

            <button
              onClick={() => router.push("/track/druva-status")}
              className="py-2 rounded-xl bg-[#F3E3FF] text-[#A259FF] text-sm font-semibold"
            >
              🔧 Update Druva Vehicle Status
            </button>

            <button
              onClick={() => router.push("/track/vehicle-logs")}
              className="py-2 rounded-xl bg-[#F3E3FF] text-[#6B4FA3] text-sm font-semibold"
            >
              📜 Add Vehicle Maintenance Log
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
