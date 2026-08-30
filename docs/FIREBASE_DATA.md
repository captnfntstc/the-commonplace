# Firebase data layer

The app uses Firebase Authentication for identity and Cloud Firestore for account data and compressed uploaded images. Firebase Storage is intentionally not used, so no Blaze billing plan is required. When Firebase is not configured, the demo keeps using browser state.

## Setup

1. Create or select a Firebase project.
2. Add a web app and copy its values into `.env.local` using `.env.example`.
3. Enable Email/Password (and Google, if used) under Authentication.
4. Create a Firestore database in Native mode.
5. Deploy `firestore.rules`:

   ```bash
   npx firebase-tools login
   npx firebase-tools use --add
   npx firebase-tools deploy --only firestore
   ```

The configured Firebase project is selected locally by the Firebase CLI; do not commit service-account credentials or a populated `.env.local`.

## Stored data

```text
handles/{handle}                         public handle -> uid lookup
users/{uid}                              public profile and privacy settings
users/{uid}/private/settings             email and private account settings
users/{uid}/private/app-state            likes, saves, follows, requests, notifications
users/{uid}/media/{mediaId}              compressed PFP, cover, or collection cover
users/{uid}/activity/saved               shareable saved-catalog IDs
users/{uid}/entries/{entryId}            posts/reviews
users/{uid}/collections/{collectionId}   created collections
users/{uid}/saved-collections/{id}       saved collections
follows/{followerUid_followingUid}       follow relationship
follow-requests/{requesterUid_targetUid} pending private-profile request
posts/{entryId}                         post ownership/privacy index
posts/{entryId}/comments/{commentId}    comments and nested likes/replies
```

Uploaded images are converted to compressed JPEG data URLs and stored in separate Firestore media documents. Each image is capped below 700,000 characters to stay safely under Firestore's 1 MiB document limit. This is appropriate for the current small app; a dedicated image service can replace it later if usage grows substantially.

Public profile data intentionally excludes email. Private-profile entries and collections require ownership or an accepted follow relationship. Saved activity is readable only when the profile setting allows it.

## One-time browser migration

On the first real Firebase sign-in, if the user document has no current `migrationVersion`, the app uploads the existing local profile, entries, interaction state, notifications, and collections. The migration version is committed only after the core upload succeeds. Remote data becomes authoritative on later sign-ins and is mirrored locally as a fallback.

Because the old browser data was not account-scoped, the first Firebase account used in that browser is treated as its owner. Use a clean browser profile if that local data belongs to someone else. Local copies are retained deliberately so a failed network request does not erase data.

## Intentionally device-local

Recent searches, metadata/image caches, the demo-auth session, and the composer’s “warn about unrated entries” preference remain in local storage or IndexedDB. They are device preferences/cache rather than account content.

## Verification checklist

- Create or edit a review, reload, and confirm it remains.
- Change the profile picture and cover, then verify `users/{uid}/media` contains compressed documents and the images appear on cards.
- Create, edit, save, and remove collections from a second browser session.
- Toggle profile/privacy settings and confirm a second user sees only allowed content.
- Add, like, reply to, and delete comments while signed in.
- Confirm Firestore requests are rejected when one user attempts to write another user's paths.
