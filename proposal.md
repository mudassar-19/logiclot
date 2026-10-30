# Project Proposal & Change Log

This document serves as a record of proposed and implemented changes for the project. Moving forward, all enhancements, feature additions, and system improvements will be documented here to provide a clear overview of the project's evolution.

## Overview
This project is built using React, Vite, Tailwind CSS, and Supabase. The goal is to incrementally improve the platform, document those changes, and present them clearly.

## Change Log

### [Date: 2026-05-13]
**Proposed Changes:**
* *Initial Setup:* Created this proposal document to track all future changes and improvements made to the project.
* *Environment Status:* Verified that the frontend successfully connects to the existing remote Supabase cloud backend, ensuring a seamless development workflow without requiring local backend hosting via Docker.
* *Performance Optimization (Hero Video):* Optimized the background video on the Home Page by implementing lazy-loading / deferred mounting. The video is now only injected into the DOM after the initial page hydration and fades in smoothly (`opacity-0` to `opacity-100`) once the video data starts loading. This significantly improves perceived page load times in production by preventing the heavy video file from blocking the initial page rendering.
* *Advanced Video Optimization:* Further optimized the background video by introducing a static fallback poster image (`hero-poster.png`) that displays instantly while the video loads or when the video is disabled. We updated the video element to use `preload="metadata"` and implemented a mobile device check. On mobile devices (screens <= 768px), the heavy video is completely disabled to save bandwidth, and users will only see the beautiful static poster image.
* *API Integration Fix (Google Generative AI):* Resolved a `404 Not Found` error when using the "Generate AI Insight" feature. The issue occurred because the previously used `gemini-1.5-flash` and `gemini-2.0-flash` models were deprecated and restricted for the configured API key. Tested the API directly to identify available models and updated the fetch endpoints in `BuyList.tsx` and `BiddingMap.tsx` to use the currently supported `gemini-2.5-flash` model, restoring AI summary functionality.
* *Pricing Sources Values Missing:* Pricing fields under “Pricing Sources” in the Buy List detail panel showed `—` because run list CSV headers like “Bid Amount” and “Buy Now Price” were not mapped to `current_bid` and `buy_now`. Added common header aliases in the Supabase `parse-run-list` edge function so those values are parsed correctly on upload. Re-uploading the run list is required to backfill existing rows.
* *Pricing Sources Backfill:* When uploaded files only include a `Price`/`price_estimate` column, the parser now backfills missing `mmr_value`, `current_bid`, and `buy_now` from `price_estimate` during inserts so the Pricing Sources panel shows values across all file types. Re-uploading the run list is required to apply this to existing rows.
* *PDF Parsing Robustness (Problem + Fix):* Some uploaded run list PDFs (Manheim, ADESA, CarMax) produced missing or inconsistent values because the layouts differ and many files omit lane/run patterns or use vendor-specific formats, causing the parser to fail or extract too few vehicles. Updated the `parse-run-list` edge function with vendor detection, flexible lane/run parsing (e.g., `A/155`, `B-0001`, `Lane 4 Run 64`), VIN-line parsing for sparse text, and vendor-aware OCR/AI prompts. This improves extraction for mixed-format PDFs and reduces failures when files are image-based or formatted differently by auction source.
* *Buy List Data Scope & Filters:* The Buy List load now pulls all `auction_vehicles` for the run list without filtering by AI recommendation. The AI filter dropdown includes “All Vehicles” and “Recommended Only,” and the filtering logic handles the new mode alongside the specific recommendation values. The stat card label was updated to reflect total vehicle count instead of “Recommended.”

---
*(Future changes will be appended below this line)*
