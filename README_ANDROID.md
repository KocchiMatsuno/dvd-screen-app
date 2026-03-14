# Android Build Instructions

This project is configured to build a native Android APK using **Capacitor** and **GitHub Actions**.

## How to build your APK:

1.  **Push your code to GitHub**:
    If you haven't already, create a repository on GitHub and push this code to the `main` or `master` branch.

2.  **Wait for the Build**:
    GitHub will automatically detect the file at `.github/workflows/android_build.yml` and start a build.

3.  **Download the APK**:
    - Go to your repository on GitHub.com.
    - Click the **Actions** tab.
    - Click on the latest workflow run (it should be named "Build Android APK").
    - Once it finishes (takes about 5-10 minutes), scroll down to the **Artifacts** section.
    - Click on **app-debug** to download the ZIP file containing your APK.

## Local Development (Optional)

If you want to run the Android project locally:
1. `npm install`
2. `npm run build`
3. `npx cap sync`
4. `npx cap open android` (Requires Android Studio)
