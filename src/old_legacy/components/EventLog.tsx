// ============================================================
// EventLog — Scrollable Event History
// ============================================================

import { useEffect, useRef } from 'react';
import type { GameEvent } from '../game/types';

interface EventLogProps {
    events: GameEvent[];
}

export function EventLog({ events }: EventLogProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [events.length]);

    return (
        <div className="sidebar-right">
            <div className="event-log-title">📜 Event Log</div>
            <div className="event-log" ref={scrollRef}>
                {events.map(event => (
                    <div key={event.id} className={`event-entry ${event.type}`}>
                        {event.message}
                    </div>
                ))}
                {events.length === 0 && (
                    <div className="event-entry system">Awaiting the first move...</div>
                )}
            </div>
        </div>
    );
}
