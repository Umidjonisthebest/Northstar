import React from "react";
import { Skeleton } from "./Skeleton.jsx";

export function SkeletonAdminList({ count = 5 }) {
  return (
    <div className="admin-main">
      <div className="page-header">
        <div>
          <Skeleton variant="title" width="30%" />
          <Skeleton variant="text" width="50%" />
        </div>
        <Skeleton variant="button" width="140px" />
      </div>
      <div>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="list-row skeleton-card" style={{ padding: "16px 20px", marginBottom: "10px" }}>
            <div style={{ flex: 1 }}>
              <Skeleton variant="title" width="40%" />
              <Skeleton variant="text" width="70%" />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Skeleton variant="button" width="80px" height="32px" />
              <Skeleton variant="button" width="80px" height="32px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonAdminDetail() {
  return (
    <div className="admin-main">
      <div className="page-header">
        <div>
          <Skeleton variant="title" width="40%" />
          <Skeleton variant="text" width="60%" />
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Skeleton variant="button" width="120px" />
          <Skeleton variant="button" width="140px" />
        </div>
      </div>
      <div className="card skeleton-card" style={{ marginBottom: "16px", padding: "20px" }}>
        <Skeleton variant="title" width="20%" />
        <Skeleton variant="text" width="30%" />
      </div>
      <table className="result-table">
        <thead>
          <tr>
            <th><Skeleton variant="text" width="80px" /></th>
            <th><Skeleton variant="text" width="100px" /></th>
            <th><Skeleton variant="text" width="120px" /></th>
            <th><Skeleton variant="text" width="120px" /></th>
            <th><Skeleton variant="text" width="80px" /></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td><Skeleton variant="text" width="100%" /></td>
              <td><Skeleton variant="text" width="100%" /></td>
              <td><span className="badge badge-muted"><Skeleton variant="text" width="80px" /></span></td>
              <td><span className="badge badge-muted"><Skeleton variant="text" width="80px" /></span></td>
              <td><Skeleton variant="button" width="80px" height="32px" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonTestEditor() {
  return (
    <div className="admin-main">
      <div className="page-header">
        <div>
          <Skeleton variant="title" width="40%" />
          <Skeleton variant="text" width="60%" />
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <Skeleton variant="button" width="180px" />
        <Skeleton variant="button" width="180px" />
      </div>
      <div className="card skeleton-card" style={{ marginBottom: "20px" }}>
        <Skeleton variant="title" width="15%" />
        <Skeleton variant="text" width="80%" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
        <Skeleton variant="title" width="15%" />
        <Skeleton variant="button" width="120px" />
      </div>
      <div className="card skeleton-card">
        <Skeleton variant="text" />
        <Skeleton variant="text" />
        <Skeleton variant="text" />
      </div>
    </div>
  );
}