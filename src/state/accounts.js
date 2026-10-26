// Demo sign-in accounts. This is a client-side wireframe, so these are not real credentials.
export const DEMO_PASSWORD = 'admin';

export const ACCOUNTS = [
  { email: 'steve@powerconnect.ai', name: 'Steve', role: 'supervisor' },
  { email: 'admin@gmail.com', name: 'Admin', role: 'supervisor' },
  { email: 'agent@gmail.com', role: 'agent' }, // signs in as the demo agent (ME); the name comes from the agent profile
];

export const accountFor = (email) => ACCOUNTS.find((a) => a.email === String(email || '').trim().toLowerCase());

export const checkLogin = (email, password) => {
  const a = accountFor(email);
  return a && password === DEMO_PASSWORD ? a : null;
};
