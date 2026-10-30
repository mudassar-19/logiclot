import fs from 'fs';

const allBrands = [
    'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Buick', 
    'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge', 'Ferrari', 'Fiat', 'Ford', 
    'Genesis', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar', 'Jeep', 
    'Kia', 'Lamborghini'
];

// Brands that generally fit standard inventory (excluding exotics/excluded)
const goodBrands = ['Chevrolet', 'Ford', 'Honda', 'Hyundai', 'Kia'];
const goodTypes = ['Sedan', 'SUV', 'Economy'];

let csvData = ["VIN,Year,Make,Model,Type,Mileage,Price,CR_Score,Recon_Estimate,Announcements"];

// 2,500 Good Entries (Matches preferences exactly)
for(let i=1; i<=2500; i++) {
    let year = Math.floor(Math.random() * (2024 - 2015 + 1)) + 2015;
    let miles = Math.floor(Math.random() * 120000);
    let price = Math.floor(Math.random() * (25000 - 2000 + 1)) + 2000;
    let cr = (Math.random() * (5.0 - 3.0) + 3.0).toFixed(1);
    let recon = Math.floor(Math.random() * 1500); // Recon under preference limit
    let make = goodBrands[Math.floor(Math.random() * goodBrands.length)];
    let type = goodTypes[Math.floor(Math.random() * goodTypes.length)];
    
    csvData.push(`1GD${i}GOOD,${year},${make},Standard,${type},${miles},${price},${cr},${recon},Clean`);
}

// 17,500 Bad Entries (Violates preferences: year, mileage, CR score, salvage, etc.)
for(let i=1; i<=17500; i++) {
    let year = Math.floor(Math.random() * (2014 - 2000 + 1)) + 2000; // Too old
    let miles = Math.floor(Math.random() * (300000 - 125000 + 1)) + 125000; // Too high
    let price = Math.floor(Math.random() * 40000) + 1000;
    let cr = (Math.random() * (2.9 - 1.0) + 1.0).toFixed(1); // Too low
    let recon = Math.floor(Math.random() * 5000) + 2000; // Too expensive to fix
    let make = allBrands[Math.floor(Math.random() * allBrands.length)];
    let announcement = Math.random() > 0.5 ? 'Salvage Title' : 'Frame Damage';
    
    csvData.push(`2BD${i}BAD,${year},${make},BadModel,Economy,${miles},${price},${cr},${recon},${announcement}`);
}

fs.writeFileSync('test-runlist-20000.csv', csvData.join('\n'));
console.log("File generated: test-runlist-20000.csv with 20000 rows.");