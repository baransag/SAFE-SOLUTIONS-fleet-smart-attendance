import { PrismaClient, Role, UserStatus, VehicleType, AssignmentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting SAFE SOLUTIONS Database Seed...');

  // 1. Clean existing records safely
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.maintenanceRecord.deleteMany();
  await prisma.fuelRecord.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.vehicleAssignment.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.officeLocation.deleteMany();
  await prisma.siteRegistry.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Initial Boss Account (Asif)
  const bossSalt = await bcrypt.genSalt(12);
  const bossHash = await bcrypt.hash('SafeBoss2026!MustChange', bossSalt);

  const bossUser = await prisma.user.create({
    data: {
      email: 'boss@safesolutions.com.pk',
      passwordHash: bossHash,
      role: Role.BOSS,
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
    },
  });
  console.log('✅ Boss Account Created: Asif (boss@safesolutions.com.pk)');

  // 3. Create Head Office Location
  const headOffice = await prisma.officeLocation.create({
    data: {
      name: 'SAFE SOLUTIONS Head Office',
      address: 'Main Commercial Boulevard, Faisalabad, Punjab, Pakistan',
      latitude: 31.4504,
      longitude: 73.1350,
      allowedRadiusMeters: 200,
      qrCodeIdentifier: 'QR-OFFICE-FSD-HQ-001',
      isActive: true,
    },
  });

  // Create Secondary Office Location
  const lahoreOffice = await prisma.officeLocation.create({
    data: {
      name: 'SAFE SOLUTIONS Lahore Branch',
      address: 'Gulberg III, Lahore, Punjab, Pakistan',
      latitude: 31.5204,
      longitude: 74.3587,
      allowedRadiusMeters: 250,
      qrCodeIdentifier: 'QR-OFFICE-LHR-BR-002',
      isActive: true,
    },
  });
  console.log('✅ Office Locations Provisioned');

  // 4. Create Initial Site Registries (Sites do NOT force QRs)
  const siteA = await prisma.siteRegistry.create({
    data: {
      name: 'Sitara Chemical Complex Project',
      clientName: 'Sitara Chemicals Industries',
      projectName: 'Security & Smart Surveillance Upgrade',
      address: 'Faisalabad Industrial Estate',
      latitude: 31.4890,
      longitude: 73.1890,
      radiusMeters: 400,
      isActive: true,
    },
  });

  const siteB = await prisma.siteRegistry.create({
    data: {
      name: 'Interloop Unit 4 Automation Site',
      clientName: 'Interloop Limited',
      projectName: 'Access Control & IoT Deployment',
      address: 'Jaranwala Road, Faisalabad',
      latitude: 31.4120,
      longitude: 73.2100,
      radiusMeters: 350,
      isActive: true,
    },
  });
  console.log('✅ Site Registries Provisioned');

  // 5. Official 11 Employees Master Data
  const officialEmployees = [
    {
      code: 'EMP-01',
      name: 'Engr. Shahzaib Ahmad',
      designation: 'Marketing Executive',
      mobile: '03007684761',
      email: 'Zaiberana37@gmail.com',
      conveyance: 'Vehicle assigned',
      vehiclePlate: 'BBE-5688',
      vehicleType: VehicleType.UNSPECIFIED,
      role: Role.EMPLOYEE,
      department: 'Marketing',
    },
    {
      code: 'EMP-02',
      name: 'Shahbaz Ahmed',
      designation: 'Application Supervisor',
      mobile: '03237684200',
      email: 'shabazbutt1132@gmail.com',
      conveyance: 'Company Bike / Personal Bike',
      vehiclePlate: 'AGN-1227-21',
      vehicleType: VehicleType.BIKE,
      role: Role.EMPLOYEE,
      department: 'Operations & Applications',
    },
    {
      code: 'EMP-03',
      name: 'Rehan Ali',
      designation: 'Application Supervisor',
      mobile: '03237674000',
      email: 'Arehan079@gmail.com',
      conveyance: 'Honda CD70',
      vehiclePlate: 'FDR-203-15',
      vehicleType: VehicleType.BIKE,
      role: Role.EMPLOYEE,
      department: 'Operations & Applications',
    },
    {
      code: 'EMP-04',
      name: 'Adnan Tahir',
      designation: 'ASM',
      mobile: '03237864100',
      email: 'tahiradnan31@gmail.com',
      conveyance: 'Company Bike',
      vehiclePlate: 'AWD-24-3818',
      vehicleType: VehicleType.BIKE,
      role: Role.EMPLOYEE,
      department: 'Sales',
    },
    {
      code: 'EMP-05',
      name: 'Adnan Ali',
      designation: 'Area Sales Manager',
      mobile: '03217684400',
      email: 'mianadnanali88@gmail.com',
      conveyance: 'Car',
      vehiclePlate: 'AHV-378...', // Incomplete plate preserved exactly
      vehicleType: VehicleType.CAR,
      role: Role.EMPLOYEE,
      department: 'Sales',
    },
    {
      code: 'EMP-06',
      name: 'M. Soulat Raza',
      designation: 'Execution Officer',
      mobile: '03397684700',
      email: 'mirzasoulat112@gmail.com',
      conveyance: 'Bike',
      vehiclePlate: 'BFF-6452/26',
      vehicleType: VehicleType.BIKE,
      role: Role.EMPLOYEE,
      department: 'Field Execution',
    },
    {
      code: 'EMP-07',
      name: 'Muneeb Ahmad',
      designation: 'Store & Inventory',
      mobile: '03077684400',
      email: 'muneeb01250@gmail.com',
      conveyance: 'Bike',
      vehiclePlate: 'BFF-7907-26',
      vehicleType: VehicleType.BIKE,
      role: Role.EMPLOYEE,
      department: 'Store & Inventory',
    },
    {
      code: 'EMP-08',
      name: 'M. Husnain Farooq',
      designation: 'Controller',
      mobile: '03468760963',
      email: 'baransag68@gmail.com',
      conveyance: 'NONE',
      vehiclePlate: null,
      vehicleType: null,
      role: Role.CONTROLLER, // CONTROLLER Role
      department: 'Operations & Control',
    },
    {
      code: 'EMP-09',
      name: 'Samaira Mubashar',
      designation: 'Manager Account & Finance',
      mobile: '03006646124',
      email: 'sm.bajwa786fsd@gmail.com',
      conveyance: 'NONE',
      vehiclePlate: null,
      vehicleType: null,
      role: Role.MANAGER, // MANAGER Role
      department: 'Accounts & Finance',
    },
    {
      code: 'EMP-10',
      name: 'M. Zahid',
      designation: 'Helper',
      mobile: '03079682902',
      email: 'muhammadzahid5324@gmail.com',
      conveyance: 'Company Bike',
      vehiclePlate: 'FDL-6381',
      vehicleType: VehicleType.BIKE,
      role: Role.EMPLOYEE,
      department: 'Support & Maintenance',
    },
    {
      code: 'EMP-11',
      name: 'Tajammul Mushtaq',
      designation: 'Area Sales Manager',
      mobile: '03217684500',
      email: 'tajammulbajwa545@gmail.com',
      conveyance: 'Car',
      vehiclePlate: 'FD-17-84',
      vehicleType: VehicleType.CAR,
      role: Role.EMPLOYEE,
      department: 'Sales',
    },
  ];

  console.log(`📦 Provisioning ${officialEmployees.length} Official Employees...`);

  for (const empData of officialEmployees) {
    // Unique secure salt and initial temp password per user
    const userSalt = await bcrypt.genSalt(12);
    // Unique password pattern with employee-specific hash
    const initialTempPassword = `Safe@${empData.code}!${empData.mobile.slice(-4)}`;
    const passHash = await bcrypt.hash(initialTempPassword, userSalt);

    const user = await prisma.user.create({
      data: {
        email: empData.email,
        passwordHash: passHash,
        role: empData.role,
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        employeeCode: empData.code,
        name: empData.name,
        phone: empData.mobile,
        personalEmail: empData.email,
        department: empData.department,
        designation: empData.designation,
        conveyanceType: empData.conveyance,
        joiningDate: new Date(),
        status: UserStatus.ACTIVE,
      },
    });

    // If employee has a vehicle plate assigned
    if (empData.vehiclePlate && empData.vehicleType) {
      const vehicleCode = `VEH-${empData.code.replace('EMP-', '')}`;
      const qrIdentifier = `QR-VEH-${empData.vehiclePlate.replace(/[^a-zA-Z0-9]/g, '')}`;

      const vehicle = await prisma.vehicle.create({
        data: {
          vehicleCode,
          registrationNumber: empData.vehiclePlate,
          vehicleType: empData.vehicleType,
          initialOdometer: 0,
          currentOdometer: 0,
          qrCodeIdentifier: qrIdentifier,
          notes: `Initial conveyance assigned to ${empData.name} (${empData.conveyance})`,
        },
      });

      // Create historical assignment
      await prisma.vehicleAssignment.create({
        data: {
          vehicleId: vehicle.id,
          employeeId: employee.id,
          assignedById: bossUser.id,
          status: AssignmentStatus.ACTIVE,
          notes: 'Official initial conveyance assignment',
        },
      });

      console.log(`  🚗 Assigned ${empData.vehicleType} [${empData.vehiclePlate}] to ${empData.name}`);
    } else {
      console.log(`  🚶 No Vehicle assigned to ${empData.name} (${empData.role})`);
    }
  }

  // Record Boss Seed Audit
  await prisma.auditLog.create({
    data: {
      actorId: bossUser.id,
      action: 'SYSTEM_INITIAL_SEED',
      entityName: 'SYSTEM',
      entityId: 'ROOT',
      newValue: {
        totalEmployees: officialEmployees.length,
        bossAccount: bossUser.email,
        timestamp: new Date().toISOString(),
      },
    },
  });

  console.log('🎉 Seed Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
