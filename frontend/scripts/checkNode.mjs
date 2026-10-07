const [major, minor] = process.versions.node.split('.').map(Number);
const supported =
  major > 22 ||
  (major === 22 && minor >= 12) ||
  (major === 20 && minor >= 19);

if (!supported) {
  console.error(`OUREA requires Node 20.19+, Node 22.12+, or a newer even-numbered LTS. Found ${process.versions.node}.`);
  process.exit(1);
}
