export type UserRole = "student" | "content_manager" | "super_admin";

export type UserStatus = "active" | "suspended";

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt?: Date;
}
