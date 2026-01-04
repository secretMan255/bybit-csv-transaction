import Dashboard from "@/page/dashboard";
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />}></Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
