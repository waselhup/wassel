const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://hiqotmimlgsrsnovtopd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA'
);

(async () => {
  const { data } = await s.auth.admin.listUsers();
  const u = data?.users?.find(x => x.email === 'alhashimali649@gmail.com');
  if (u) {
    console.log('Found user:', u.id, u.email);
    const { error } = await s.auth.admin.updateUserById(u.id, { password: 'Wassel2026!' });
    if (error) console.log('Error:', error.message);
    else console.log('PASSWORD RESET to: Wassel2026!');
  } else {
    console.log('User not found, creating...');
    const { data: d2, error: e2 } = await s.auth.admin.createUser({
      email: 'alhashimali649@gmail.com',
      password: 'Wassel2026!',
      email_confirm: true,
    });
    if (e2) console.log('Create error:', e2.message);
    else console.log('USER CREATED:', d2.user?.id, '- Password: Wassel2026!');
  }
})();
