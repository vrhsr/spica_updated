# **App Name**: MediPPT Portal

## Core Features:

- Admin Login: Secure admin login via email/password.
- Representative Login: Secure representative login via phone OTP.
- Role-Based Access: Restrict access based on user roles (admin/rep) using middleware.
- Doctor Management: Admin interface to add doctors and assign PPT slide numbers.
- PPT Auto-Generation: Automatically generate PPTs upon doctor update using a Cloud Function tool, triggered when the 'dirty' flag is set.
- Representative Dashboard: Display a list of doctors in the representative's city with PPT download option.
- Update Requests: Allow representatives to request updates for doctors and slides.

## Style Guidelines:

- Primary color: Soft blue (#7EC8E3) for a calming, professional feel.
- Background color: Very light blue (#EAF6FA), almost white.
- Accent color: Pale violet (#B19CD9) for highlights and calls to action.
- Body font: 'Inter' sans-serif for clear readability
- Headline font: 'Space Grotesk' sans-serif for a modern and professional style
- Use minimalist, professional icons related to medical and presentation themes.
- Clean, structured layouts with clear information hierarchy for both admin and representative dashboards.
- Subtle animations on transitions and loading states for a polished user experience.