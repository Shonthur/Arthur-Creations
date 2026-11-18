# Client reviews: set-up (about 10 minutes, free)

This lets a client click a link in your email, sign in with Google, type a review, and have their **name and profile picture** added automatically. You approve each review first. Then it shows on your home page.

## Part A. Create the Firebase project
1. Go to https://console.firebase.google.com and sign in with arthurshon@gmail.com.
2. Click **Create a project**. Name it `avalon-reviews`. Turn Google Analytics **off**. Click Create.
3. Left menu: **Build > Authentication > Get started**. Open **Sign-in method**, choose **Google**, turn it **Enable**, pick your email as the support email, **Save**.
4. Still in Authentication, open **Settings > Authorized domains > Add domain**. Add: `shonthur.github.io`
5. Left menu: **Build > Firestore Database > Create database**. Choose **Production mode** and any location (a Europe one is fine). Click Enable.
6. In Firestore open the **Rules** tab. Delete everything, paste the rules below, click **Publish**.
7. Click the gear icon > **Project settings**. Under **Your apps** click the **web icon `</>`**. Name it `website`, click Register app. Copy the `firebaseConfig` block you see.
8. Send me that block (it is safe to share, it is public by design). I will put it in `js/firebase-config.js`.

## Rules to paste in step 6
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() {
      return request.auth != null
        && request.auth.token.email == "arthurshon@gmail.com"
        && request.auth.token.email_verified == true;
    }
    match /reviews/{uid} {
      allow read: if resource.data.status == "approved"
        || (request.auth != null && resource.data.uid == request.auth.uid)
        || isOwner();
      allow create: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['uid','name','role','message','photo','status','created'])
        && request.resource.data.uid == uid
        && request.resource.data.status == "pending"
        && request.resource.data.name is string && request.resource.data.name.size() <= 80
        && request.resource.data.role is string && request.resource.data.role.size() <= 80
        && request.resource.data.message is string
        && request.resource.data.message.size() >= 10 && request.resource.data.message.size() <= 800
        && request.resource.data.photo is string
        && (request.resource.data.photo == ""
            || request.resource.data.photo.matches('https://[a-z0-9-]+\\.googleusercontent\\.com/.*'));
      allow update, delete: if isOwner();
    }
  }
}
```
What these rules do: anyone can read only **approved** reviews; a signed-in client can send **one** review that starts as **pending**; only you can approve, change or delete.

## How you use it
1. Send each client the email below.
2. Open `pages/manage_reviews.html` (there is a link on your Owner upload page), sign in with Google, press **Approve and publish**.

## Email to send
Subject: Could you share a short review of my work?

> Hello [Name],
>
> Thank you for working with Avalon Corporate Solutions. If you are happy with the work, would you write a short review? It takes about one minute.
>
> 1. Open this link: https://shonthur.github.io/Arthur-Creations/pages/leave_review.html
> 2. Sign in with Google (your name and profile picture are added automatically).
> 3. Type your review and press Send.
>
> Your review is only published after I check it. Thank you for your support!
>
> Kakande Arthur
> Avalon Corporate Solutions | +256 745 652 778
