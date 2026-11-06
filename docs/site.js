// Shared settings for the Swap web pages.
// CONTACT_EMAIL: the address people can write to about privacy, deletion or safety.
// Google Play requires a working contact in the privacy policy, so fill this in
// before submitting the app (a dedicated address like swap.support@... is best).
window.SWAP = {
  CONTACT_EMAIL: '',
  // Set to true once Swap is published on Google Play: shared item pages then show a
  // "Get Swap on Google Play" button instead of "coming soon".
  PLAY_LIVE: false,
  SUPABASE_URL: 'https://vwkaohiukqmotwesdqvi.supabase.co',
  // Public anon key (the same one inside the app). Row-level security protects the data.
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3a2FvaGl1a3Ftb3R3ZXNkcXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMDU0NzUsImV4cCI6MjEwNjg4MTQ3NX0.ke2fcG5Mytp7rxmutoIAEQMBHmAo04DhnAqBvbumEu0',
};

document.addEventListener('DOMContentLoaded', () => {
  const email = window.SWAP.CONTACT_EMAIL;
  document.querySelectorAll('[data-contact]').forEach((el) => {
    if (email) {
      const a = document.createElement('a');
      a.href = 'mailto:' + email;
      a.textContent = email;
      el.replaceChildren(a);
    } else {
      el.textContent = '[contact email to be added]';
    }
  });
});
