const KEY = "junil_user";

export function saveUser(user) {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function loadUser() {
  const v = localStorage.getItem(KEY);
  return v ? JSON.parse(v) : null;
}

export function clearUser() {
  localStorage.removeItem(KEY);
}
