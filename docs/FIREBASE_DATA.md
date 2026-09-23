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

## Sign in with Apple

Apple authentication is implemented through Firebase Authentication. Complete these provider-side steps before the Apple button can work in production:

1. Use an active Apple Developer Program account. In Certificates, Identifiers & Profiles, enable **Sign in with Apple** on the primary App ID.
2. Create a **Services ID** for the website, associate it with the primary App ID, and register every production domain.
3. Add Firebase's callback as the return URL: `https://YOUR_FIREBASE_PROJECT_ID.firebaseapp.com/__/auth/handler`.
4. Create a Sign in with Apple private key and note its Key ID and the Apple Team ID.
5. In Firebase Console → Authentication → Sign-in method, enable Apple and enter the Services ID, Team ID, Key ID, and private key.
6. Add local and production hosts to Firebase Authentication's **Authorized domains**. Apple requires a valid HTTPS production domain; use the Firebase emulator or an HTTPS tunnel for end-to-end local testing.
7. If users may choose Hide My Email, register Firebase's email-sending domain with Apple's private email relay so verification and account emails reach relay addresses.

The Apple private key is configured only in Apple/Firebase consoles. Never put it in `.env.local`, `VITE_*` variables, or browser code. Apple only returns a person's name on the first authorization, so the app must preserve the initial Firebase profile data.

## Stored data

```text
handles/{handle}                         public handle -> uid lookup
users/{uid}                              public profile and privacy settings
users/{uid}/private/settings             email and private account settings
users/{uid}/private/app-state            likes, saves, follows, requests, notifications
users/{uid}/private/feed-preferences      bounded recommendation affinity weights
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

Public profile data intentionally excludes email. Private-profile entries, collections, reviews, and interactions require ownership or mutual following: both `viewer -> owner` and `owner -> viewer` follow documents must exist. One-way and pending relationships cannot read private content. Saved activity is readable only when the profile setting allows it and the same profile-content rule passes.

## Personalized Home feed

The authenticated `GET /api/feed` endpoint reads chronological 40-entry candidate windows through the Admin SDK, removes deactivated and inaccessible private accounts, then applies deterministic affinity and diversity ranking. The category chips use the same endpoint with `category=album|book|film|game|song|tv`; `All` is the default. Responses are always `private, no-store` and use opaque keyset cursors.

`POST /api/feed/signals` records only decaying aggregate weights for media type, genre, and creator. Raw searches and browsing history are never stored. `DELETE /api/feed/preferences` powers the **Reset Home recommendations** setting. Entry-open deduplication remains account-scoped and device-local for 24 hours.

Deploy both `firestore.rules` and `firestore.indexes.json` before enabling `VITE_PERSONALIZED_HOME_FEED`. The endpoint also requires the server-side `FIREBASE_ADMIN_*` values described below.

## One-time browser migration

On the first real Firebase sign-in, if the user document has no current `migrationVersion`, the app uploads the existing local profile, entries, interaction state, notifications, and collections. The migration version is committed only after the core upload succeeds. Remote data becomes authoritative on later sign-ins and is mirrored locally as a fallback.

Because the old browser data was not account-scoped, the first Firebase account used in that browser is treated as its owner. Use a clean browser profile if that local data belongs to someone else. Local copies are retained deliberately so a failed network request does not erase data.

## Intentionally device-local

Recent searches, metadata/image caches, 24-hour feed-open deduplication records, the Firebase Auth persistence record, and the composer’s “warn about unrated entries” preference remain in local storage or IndexedDB. They are device preferences/cache rather than account content.

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
- Confirm private content is hidden for both one-way follow directions and appears only after the relationship becomes mutual.
- Remove one half of a mutual relationship and confirm private cards are purged without a reload.
- Scroll beyond the initial 20 Home cards and confirm no entry is duplicated or skipped across cursors.
- Reset Home recommendations in Settings and confirm the feed remains usable with cold-start ranking.
- Add, like, reply to, and delete comments while signed in.
- Confirm Firestore requests are rejected when one user attempts to write another user's paths.
