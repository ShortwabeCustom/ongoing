import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/lucia';
import { ActivityService } from '@/lib/services/activity';

export async function GET(request: NextRequest) {
  try {
    const sessionData = await getSession();
    if (!sessionData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const findingId = searchParams.get('findingId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!findingId) {
      return NextResponse.json(
        { error: 'findingId is required' },
        { status: 400 }
      );
    }

    const activities = await ActivityService.getRecentActivity(findingId, limit);

    return NextResponse.json({
      success: true,
      data: activities,
      count: activities.length,
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}
