import db from '../lib/db'

async function verifyContext() {

  console.log('\n🔍 VERIFICANDO CONTEXTO DE IMPORTACIÓN\n')

  // Verificar project
  const project = await db.project.findUnique({
    where: { id: 'cmsoc6p7l0000h1acb6i9uoyt' },
  })

  if (!project) {
    console.error('❌ Project NO ENCONTRADO: cmsoc6p7l0000h1acb6i9uoyt')
    process.exit(1)
  }

  console.log(`✅ Project: ${project.name} (ID: ${project.id})`)

  // Verificar test session
  const session = await db.testSession.findUnique({
    where: { id: 'cmsoc6pbq0003h1ac6hgztsda' },
    include: { project: true, version: true },
  })

  if (!session) {
    console.error('❌ TestSession NO ENCONTRADA: cmsoc6pbq0003h1ac6hgztsda')
    process.exit(1)
  }

  console.log(`✅ TestSession: ${session.name} (ID: ${session.id})`)
  console.log(`   Date: ${session.date}`)
  console.log(`   Version: ${session.version.version}`)

  // Verificar usuario Alexis
  const user = await db.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'alexis', mode: 'insensitive' } },
        { name: { contains: 'Alexis', mode: 'insensitive' } },
      ],
    },
  })

  if (!user) {
    console.error('❌ Usuario Alexis NO ENCONTRADO')
    process.exit(1)
  }

  console.log(`✅ User: ${user.name} (${user.email})`)
  console.log(`   ID: ${user.id}`)
  console.log(`   Role: ${user.role}`)

  // Contar findings actuales
  const findingCount = await db.finding.count({
    where: {
      projectId: project.id,
      testSessionId: session.id,
      deletedAt: null,
    },
  })

  console.log(`\n📊 Findings actuales: ${findingCount}`)

  console.log('\n✅ CONTEXTO VERIFICADO\n')

  return {
    projectId: project.id,
    testSessionId: session.id,
    userId: user.id,
    projectName: project.name,
    sessionName: session.name,
  }
}

verifyContext()
  .then((ctx) => {
    console.log('\nExportando contexto para ETL:')
    console.log(JSON.stringify(ctx, null, 2))
  })
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
