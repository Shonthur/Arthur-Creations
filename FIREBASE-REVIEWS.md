# Client reviews with private links: set-up (about 10 minutes, free)

How it works: you create a private link for each client in `pages/manage_reviews.html` and send it on WhatsApp. The client opens it, taps 1 to 5 stars, types a review and can add a small round photo. Only people with a link can post, and each link works once. You approve every review before it shows on your home page.

## Part A. Create the Firebase project
1. Go to https://console.firebase.google.com and sign in with arthurshon@gmail.com.
2. Click **Create a project**. Name it `avalon-reviews`. Turn Google Analytics **off**. Click Create.
3. Left menu: **Build > Authentication > Get started**. Open **Sign-in method**, choose **Google**, turn it **Enable**, pick your email as support email, **Save**. (Only you use Google sign-in, to open the owner page.)
4. In Authentication open **Settings > Authorized domains > Add domain**. Add: `shonthur.github.io`
5. Left menu: **Build > Firestore Database > Create database**. Choose **Production mode** and any location. Click Enable.
6. In Firestore open the **Rules** tab. Delete everything, paste the rules below, click **Publish**.
7. Gear icon > **Project settings**. Under **Your apps** click the web icon `</>`. Name it `website`, click Register app. Copy the `firebaseConfig` block.
8. Send me that block (it is public by design). I put it in `js/firebase-config.js`.

## Rules to paste in step 6
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() {
      return request.auth != null
        && request.auth.token.email in ["arthurshon@gmail.com", "www.arthurshon@gmail.com"]
        && request.auth.token.email_verified == true;
    }
    // private links: only you can create or list them; a client reads only the one they hold
    match /invites/{code} {
      allow get: if true;
      allow list, create, update, delete: if isOwner();
    }
    match /reviews/{code} {
      allow get: if true;
      allow list: if resource.data.status == "approved" || isOwner();
      allow create: if exists(/databases/$(database)/documents/invites/$(code))
        && request.resource.data.keys().hasOnly(['code','name','role','project','rating','message','photo','image','status','created'])
        && request.resource.data.code == code
        && request.resource.data.status == "pending"
        && request.resource.data.name is string && request.resource.data.name.size() <= 80
        && request.resource.data.role is string && request.resource.data.role.size() <= 80
        && request.resource.data.project is string && request.resource.data.project.size() <= 100
        && request.resource.data.rating is int && request.resource.data.rating >= 1 && request.resource.data.rating <= 5
        && request.resource.data.message is string
        && request.resource.data.message.size() >= 10 && request.resource.data.message.size() <= 800
        && request.resource.data.photo is string && request.resource.data.photo.size() <= 60000
        && (request.resource.data.photo == "" || request.resource.data.photo.matches('data:image/jpeg;base64,.*'))
        && request.resource.data.image is string && request.resource.data.image.size() <= 450000;
      allow update, delete: if isOwner();
    }
  }
}
```
What the rules do: no link, no review. A review can only be created once per link, starts as pending, and only you can approve or delete it. Visitors can read only approved reviews.

## How you use it
1. Open `pages/manage_reviews.html` (link on the Owner upload page) and sign in with Google.
2. Type the client name and project, add a photo of the finished work (optional), press **Create link**.
3. Press **Send on WhatsApp** (or Copy link) and send it to the client.
4. When she submits, her review appears under **Waiting for your approval**. Press **Approve and publish**.
