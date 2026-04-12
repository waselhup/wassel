const fs = require('fs');

let c = fs.readFileSync('client/src/pages/LandingPage.tsx', 'utf8');
if (c.charCodeAt(0) === 0xFEFF) c = c.slice(1);

if (!c.includes('VideoDemo')) {
  // Add import at top
  c = c.replace(
    "import { WasselLogo } from '../components/WasselLogo';",
    "import { WasselLogo } from '../components/WasselLogo';\nimport VideoDemo from '../components/landing/VideoDemo';"
  );

  // Add <VideoDemo /> between social proof bar and features section
  const featuresAnchor = '<section id="features"';
  const idx = c.indexOf(featuresAnchor);
  if (idx !== -1) {
    c = c.substring(0, idx) + '{/* VIDEO DEMO */}\n      <VideoDemo />\n\n      ' + c.substring(idx);
    console.log('VideoDemo added before features section');
  } else {
    console.log('ERROR: Could not find features section anchor');
  }

  fs.writeFileSync('client/src/pages/LandingPage.tsx', c, 'utf8');
  console.log('LandingPage.tsx updated');
} else {
  console.log('VideoDemo already present');
}

// Verify
const final = fs.readFileSync('client/src/pages/LandingPage.tsx', 'utf8');
console.log('Has VideoDemo import: ' + final.includes("import VideoDemo"));
console.log('Has <VideoDemo />: ' + final.includes('<VideoDemo'));