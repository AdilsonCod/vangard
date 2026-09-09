export type UserProfileData = {
  id?: string;
  authUid?: string;
  legacyId?: string;
  email?: string;
  [key: string]: unknown;
};

export const isCanonicalUserProfile = (documentId: string, profile: UserProfileData, uid: string) =>
  documentId === uid && profile.id === uid && profile.authUid === uid;

export const buildCanonicalUserProfile = (
  legacyProfile: UserProfileData,
  canonicalProfile: UserProfileData,
  legacyDocumentId: string,
  uid: string,
  migratedAt: string,
  deletePasswordValue: unknown,
): UserProfileData => ({
  ...legacyProfile,
  ...canonicalProfile,
  id: uid,
  authUid: uid,
  legacyId: legacyProfile.legacyId || legacyDocumentId,
  password: deletePasswordValue,
  identityMigratedAt: migratedAt,
});
