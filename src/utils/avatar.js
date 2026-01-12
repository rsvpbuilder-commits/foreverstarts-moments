export function initialsAvatar(name = 'Guest') {
  const encoded = encodeURIComponent(name);
  // Using UI Avatars - more reliable for React Native
  return `https://ui-avatars.com/api/?name=${encoded}&background=7B9AAB&color=fff&size=128&rounded=true`;
}
