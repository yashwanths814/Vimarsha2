// src/app/maintenance/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { db, auth } from "@/shared/firebaseConfig";
import MainHeader from "@/components/Header";
import TrackSidebar from "@/components/TrackSidebar"; // or a MaintenanceSidebar you create
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

type Fault = {
  id: string;
  severity: "critical" | "medium" | "low";
  status: "open" | "verified" | "closed";
};

type Task = {
  id: string;
  title: string;
  status: "pending" | "done";
  dueDate?: Timestamp;
};

type Activity = {
  id: string;
  action: string;
  createdAt?: Timestamp;
};

export default function MaintenanceDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [druva, setDruva] = useState<any>(null);
  const [openFaults, setOpenFaults] = useState<Fault[]>([]);
  const [tasksToday, setTasksToday] = useState<Task[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/maintenance/login");
        return;
      }
      await loadData(user.uid);
    });

    return () => unsub();
  }, []);

  async function loadData(userId: string) {
    setLoading(true);

    // Druva vehicle status
    const druvaSnap = await getDoc(doc(db, "druvaStatus", "vehicle-1"));
    setDruva(druvaSnap.exists() ? druvaSnap.data() : null);

    // Open faults
    const qFaults = query(
      collection(db, "faults"),
      where("status", "==", "open")
    );
    const fSnap = await getDocs(qFaults);
    const faults: Fault[] = fSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    setOpenFaults(faults);

    // Today’s tasks (simple: status pending)
    const qTasks = query(
      collection(db, "maintenanceTasks"),
      where("assignedTo", "==", userId),
      where("status", "==", "pending")
    );
    const tSnap = await getDocs(qTasks);
    const t: Task[] = tSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    setTasksToday(t);

    // Recent activity
    const qAct = query(
      collection(db, "maintenanceActivity"),
      orderBy("createdAt", "desc")
    );
    const aSnap = await getDocs(qAct);
    const a: Activity[] = aSnap.docs.slice(0, 10).map((d) => ({ id: d.id, ...(d.data() as any) }));
    setActivity(a);

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7E8FF]">
        <div className="animate-spin h-10 w-10 border-4 border-[#A259FF] border-t-transparent rounded-full" />
      </div>
    );
  }

  const openCritical = openFaults.filter((f) => f.severity === "critical").length;
  const openMedium = openFaults.filter((f) => f.severity === "medium").length;
  const openLow = openFaults.filter((f) => f.severity === "low").length;

  return (
    <div className="min-h-screen flex bg-[#F7E8FF]">
      <TrackSidebar /> {/* or MaintenanceSidebar */}
      <main className="flex-1 ml-64 p-4 sm:p-6">
        <MainHeader title="Maintenance Dashboard" />

        {/* Top cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {/* Druva Status */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold text-sm text-gray-600 mb-2">Druva Vehicle Status</h2>
            <p className="text-xl font-bold text-[#A259FF]">
              {druva?.status || "Unknown"}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Battery: {druva?.batteryHealth ?? "--"}% | Motor: {druva?.motorHealth ?? "--"}%
            </p>
          </div>

          {/* Open Faults */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold text-sm text-gray-600 mb-2">Open Faults</h2>
            <p className="text-2xl font-extrabold text-[#E05F5F]">
              {openFaults.length}
            </p>
            <div className="flex gap-3 mt-2 text-xs text-gray-600">
              <span>Critical: {openCritical}</span>
              <span>Medium: {openMedium}</span>
              <span>Low: {openLow}</span>
            </div>
          </div>

          {/* Today’s Tasks */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold text-sm text-gray-600 mb-2">Today’s Tasks</h2>
            <p className="text-2xl font-extrabold text-[#6B4FA3]">
              {tasksToday.length}
            </p>
            <ul className="mt-2 text-xs text-gray-600 max-h-24 overflow-y-auto">
              {tasksToday.map((task) => (
                <li key={task.id} className="truncate">
                  • {task.title}
                </li>
              ))}
              {tasksToday.length === 0 && (
                <li className="text-gray-400">No tasks pending 🎉</li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom Section: Recent Activity & Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* Recent Activity */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold text-sm text-gray-600 mb-3">Recent Activity</h2>
            <ul className="space-y-2 max-h-64 overflow-y-auto text-xs">
              {activity.map((item) => (
                <li key={item.id} className="flex justify-between border-b last:border-b-0 pb-1">
                  <span>{item.action}</span>
                  <span className="text-gray-400">
                    {item.createdAt?.toDate().toLocaleString() ?? ""}
                  </span>
                </li>
              ))}
              {activity.length === 0 && (
                <li className="text-gray-400">No activity yet.</li>
              )}
            </ul>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-3">
            <h2 className="font-semibold text-sm text-gray-600 mb-2">Quick Actions</h2>
            <button
              onClick={() => router.push("/maintenance/component-failure/new")}
              className="py-2 px-3 rounded-xl bg-[#A259FF] text-white text-sm font-semibold shadow"
            >
              ➕ Log Component Failure
            </button>
            <button
              onClick={() => router.push("/maintenance/druva-status")}
              className="py-2 px-3 rounded-xl bg-[#F3E3FF] text-[#A259FF] text-sm font-semibold"
            >
              🔧 Update Druva Vehicle
            </button>
            <button
              onClick={() => router.push("/maintenance/vehicle-logs")}
              className="py-2 px-3 rounded-xl bg-[#F3E3FF] text-[#6B4FA3] text-sm font-semibold"
            >
              📜 Add Maintenance Log
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
