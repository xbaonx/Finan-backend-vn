const bcrypt = require('bcryptjs');

// Test password hashing
const password = 'admin123';
const hash = bcrypt.hashSync(password, 10);

console.log('Password:', password);
console.log('Generated hash:', hash);
console.log('Hash comparison:', bcrypt.compareSync(password, hash));

// Test with the hash from .env.example
const envHash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
console.log('Env hash comparison:', bcrypt.compareSync(password, envHash));

// Test with different password
console.log('Wrong password test:', bcrypt.compareSync('wrongpass', hash));
