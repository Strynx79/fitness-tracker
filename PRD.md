# Fitness & Self-Improvement OS — Product Requirements Document (MVP)

## 1. Tech Stack
- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui + Lucide Icons + Recharts
- **Database:** PostgreSQL (running via local Docker container) + Prisma ORM
- **Validation:** Zod

## 2. Core MVP Feature Slices (Build in Exact Order)
- **Slice 1 (Daily Metrics & Macros):** Log daily `date`, `weight_kg`, `calories`, `protein_g`, and `notes`. View a 30-day weight trend line chart and recent history table.
- **Slice 2 (Self-Improvement Habit Engine):** Create daily habits (e.g., "Hit Protein Goal", "8h Sleep", "Read 20m"). Check/uncheck habits for today (`YYYY-MM-DD`). Automatically calculate current streak and 7-day completion rate.
- **Slice 3 (Workout & Progressive Overload Logger):** Create a Workout Session (e.g., Push, Pull, Legs, Upper, Lower). Add exercises to the session and log individual sets (`set_number`, `weight_kg`, `reps`, `rpe`). Show the previous session's top set for that exercise so the user knows what weight/reps to beat.
- **Slice 4 (Unified Dashboard):** A single home screen showing today's habit checklist, latest body weight vs goal, and last completed workout summary.
