import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/lucia';
import { RealtimeService } from '@/lib/services/realtime';
import { ActivityService } from '@/lib/services/activity';

export async function GET(request: NextRequest) {
  try {
    const sessionData = await getSession();
    if (!sessionData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const findingId = searchParams.get('findingId');

    if (!findingId) {
      return NextResponse.json(
        { error: 'findingId is required' },
        { status: 400 }
      );
    }

    const activeUsers = RealtimeService.getActiveUsers(findingId);
    const stats = await ActivityService.getCoActivityStats(findingId);

    return NextResponse.json({
      success: true,
      data: {
        activeUsers,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching presence:', error);
    return NextResponse.json(
      { error: 'Failed to fetch presence' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionData = await getSession();
    if (!sessionData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status, resourceId } = body;

    if (!status || !resourceId) {
      return NextResponse.json(
        { error: 'status and resourceId are required' },
        { status: 400 }
      );
    }

    const presenceInfo = await ActivityService.updatePresence(
      sessionData.user.id,
      status
    );

    return NextResponse.json({
      success: true,
      data: presenceInfo,
    });
  } catch (error) {
    console.error('Error updating presence:', error);
    return NextResponse.json(
      { error: 'Failed to update presence' },
      { status: 500 }
    );
  }
}
