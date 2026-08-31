# Firebase data layer

The app uses Firebase Authentication for identity and Cloud Firestore for account data and compressed uploaded images. Firebase Storage is intentionally not used, so no Blaze billing plan is required. When Firebase is not configured, account access remains logged out and the app shows a configuration error if someone attempts to sign in or register.

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

Recent searches, metadata/image caches, the Firebase Auth persistence record, and the composer’s “warn about unrated entries” preference remain in local storage or IndexedDB. They are device preferences/cache rather than account content.

## Clean email verification links

When the server mail settings are configured, the app sends its own one-time verification URL in this form:

```text
https://YOUR_PUBLIC_APP_DOMAIN/v/Ab3xK9...
```

The emailed URL contains no Firebase API key or `oobCode`. The random token is stored in the server-only `authActionLinks` Firestore collection, expires after 24 hours, and is deleted when redeemed. Resending is limited to once per minute. Client access to this collection is denied by the default Firestore rules.

Configure these server-only values in Render (never prefix them with `VITE_`):

1. Set `APP_BASE_URL` to the deployed site origin.
2. In Firebase Console → Project settings → Service accounts, generate a private key. Copy its `project_id`, `client_email`, and `private_key` into the matching `FIREBASE_ADMIN_*` environment variables. Keep the downloaded JSON out of the repository.
3. For the Gmail SMTP example, enable two-step verification on the sender account, create a Google App Password, and set `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` in Render.
4. Redeploy the Render service after saving the variables.

The app does not fall back to Firebase's built-in verification email. If any server value is missing, sending fails visibly so the branded template and clean `/v/...` link cannot be silently replaced by Firebase's raw action URL.

## Verification checklist

- Create or edit a review, reload, and confirm it remains.
- Change the profile picture and cover, then verify `users/{uid}/media` contains compressed documents and the images appear on cards.
- Create, edit, save, and remove collections from a second browser session.
- Toggle profile/privacy settings and confirm a second user sees only allowed content.
- Add, like, reply to, and delete comments while signed in.
- Confirm Firestore requests are rejected when one user attempts to write another user's paths.
