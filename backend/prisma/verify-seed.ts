import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('🔍 Running SAFE SOLUTIONS Strict Data Integrity Verification...');

  // 1. Verify Boss Account
  const boss = await prisma.user.findUnique({
    where: { email: 'boss@safesolutions.com.pk' },
  });
  if (!boss) throw new Error('FAIL: Boss account boss@safesolutions.com.pk not found');
  if (boss.role !== Role.BOSS) throw new Error(`FAIL: Boss role is ${boss.role}, expected BOSS`);
  console.log('  ✅ Boss Asif account verified with role BOSS');

  // 2. Verify Total Employees Count
  const allEmployees = await prisma.employee.findMany({
    include: {
      user: true,
      assignments: {
        include: { vehicle: true },
      },
    },
  });

  if (allEmployees.length !== 11) {
    throw new Error(`FAIL: Expected exactly 11 unique employees, found ${allEmployees.length}`);
  }
  console.log('  ✅ Exactly 11 unique employees verified');

  // 3. Verify Adnan Tahir Uniqueness
  const adnanTahirRecords = allEmployees.filter((e) => e.name.toLowerCase().includes('adnan tahir'));
  if (adnanTahirRecords.length !== 1) {
    throw new Error(`FAIL: Adnan Tahir must exist ONCE, found ${adnanTahirRecords.length}`);
  }
  console.log('  ✅ Adnan Tahir exists exactly once');

  // Helper map
  const empMap = new Map(allEmployees.map((e) => [e.employeeCode, e]));

  // 4. Verify Individual Employees & Vehicles
  const emp01 = empMap.get('EMP-01');
  const emp01Veh = emp01?.assignments.find((a) => a.status === 'ACTIVE')?.vehicle;
  if (emp01Veh?.registrationNumber !== 'BBE-5688') {
    throw new Error(`FAIL: Shahzaib plate mismatch: ${emp01Veh?.registrationNumber} !== BBE-5688`);
  }
  console.log('  ✅ Shahzaib plate verified as BBE-5688');

  const emp05 = empMap.get('EMP-05'); // Adnan Ali
  const emp05Veh = emp05?.assignments.find((a) => a.status === 'ACTIVE')?.vehicle;
  if (emp05Veh?.registrationNumber !== 'AHV-378...') {
    throw new Error(`FAIL: Adnan Ali plate mismatch: ${emp05Veh?.registrationNumber} !== AHV-378...`);
  }
  if (emp05Veh?.vehicleType !== 'CAR') {
    throw new Error(`FAIL: Adnan Ali vehicle type mismatch: ${emp05Veh?.vehicleType} !== CAR`);
  }
  console.log('  ✅ Adnan Ali plate verified as AHV-378... and type CAR');

  const emp11 = empMap.get('EMP-11'); // Tajammul Mushtaq
  const emp11Veh = emp11?.assignments.find((a) => a.status === 'ACTIVE')?.vehicle;
  if (emp11Veh?.registrationNumber !== 'FD-17-84') {
    throw new Error(`FAIL: Tajammul plate mismatch: ${emp11Veh?.registrationNumber} !== FD-17-84`);
  }
  if (emp11Veh?.vehicleType !== 'CAR') {
    throw new Error(`FAIL: Tajammul vehicle type mismatch: ${emp11Veh?.vehicleType} !== CAR`);
  }
  console.log('  ✅ Tajammul plate verified as FD-17-84 and type CAR');

  const emp08 = empMap.get('EMP-08'); // M. Husnain Farooq (Controller)
  if (emp08?.assignments.length !== 0) {
    throw new Error('FAIL: M. Husnain Farooq must have NO vehicle assigned');
  }
  if (emp08?.user.role !== 'CONTROLLER') {
    throw new Error(`FAIL: M. Husnain Farooq must have role CONTROLLER, got ${emp08?.user.role}`);
  }
  console.log('  ✅ M. Husnain Farooq has NO vehicle and role CONTROLLER');

  const emp09 = empMap.get('EMP-09'); // Samaira Mubashar (Manager)
  if (emp09?.assignments.length !== 0) {
    throw new Error('FAIL: Samaira Mubashar must have NO vehicle assigned');
  }
  if (emp09?.user.role !== 'MANAGER') {
    throw new Error(`FAIL: Samaira Mubashar must have role MANAGER, got ${emp09?.user.role}`);
  }
  console.log('  ✅ Samaira Mubashar has NO vehicle and role MANAGER');

  // Verify other plates
  const checks = [
    { code: 'EMP-02', plate: 'AGN-1227-21' },
    { code: 'EMP-03', plate: 'FDR-203-15' },
    { code: 'EMP-04', plate: 'AWD-24-3818' },
    { code: 'EMP-06', plate: 'BFF-6452/26' },
    { code: 'EMP-07', plate: 'BFF-7907-26' },
    { code: 'EMP-10', plate: 'FDL-6381' },
  ];

  for (const c of checks) {
    const emp = empMap.get(c.code);
    const veh = emp?.assignments.find((a) => a.status === 'ACTIVE')?.vehicle;
    if (veh?.registrationNumber !== c.plate) {
      throw new Error(`FAIL: ${c.code} plate mismatch: ${veh?.registrationNumber} !== ${c.plate}`);
    }
  }
  console.log('  ✅ All individual bike plates verified');

  console.log('🏆 ALL SECTION 62 & 64 STRICT INTEGRITY CHECKS PASSED!');
}

verify()
  .catch((e) => {
    console.error('❌ Verification Failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
