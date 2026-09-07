import React from "react";
import { TrendingPlacesView } from "../components/TrendingPlacesView";

export default function Trending() {
  return (
    <div className="min-h-screen bg-sand-100 py-10">
      <div className="max-w-content mx-auto px-6">
        <TrendingPlacesView />
      </div>
    </div>
  );
}
