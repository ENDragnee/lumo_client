import bcrypt from 'bcrypt';

export async function hashPassword(password: string) {
  const saltRounds = 10;
  const salt = await bcrypt.genSalt(saltRounds);
  return await bcrypt.hash(password, salt);
}

export async function verifyPassword(
  inputPassword: string,
  hashedPassword: string,
) {
  return await bcrypt.compare(inputPassword, hashedPassword);
}
