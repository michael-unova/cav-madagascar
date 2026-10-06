import type { Course } from "../types/course"

/**
 * Contest card artwork is content-managed. Admins can upload an optional
 * thumbnail for each concours. When none exists, CAV uses one neutral
 * branded fallback instead of choosing an illustration from the title.
 */
export function courseIllustration(course: Course | null | undefined) {
  return course?.thumbnailUrl || "/assets/illustrations/default.svg"
}
