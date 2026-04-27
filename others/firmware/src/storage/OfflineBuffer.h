#ifndef OFFLINE_BUFFER_H
#define OFFLINE_BUFFER_H

#include <Arduino.h>
#include "../connectivity/BackendClient.h"

/**
 * OfflineBuffer — LittleFS-backed queue for readings captured while WiFi is
 * unavailable.
 *
 * Design decisions:
 *  - JSONL (newline-delimited JSON): append-only, human-readable, no seek needed.
 *  - Hard cap at OFFLINE_BUFFER_MAX_BYTES: once reached, new pushes are silently
 *    dropped so the oldest data is preserved.
 *  - Replay is all-or-nothing per WiFi session.  If a POST fails mid-replay
 *    (WiFi drops again) the file is left intact for the next reconnect.
 *  - On mid-replay reboot the file survives.  Entries already sent will be
 *    re-posted (duplicates), which is acceptable for a sensor monitoring app.
 */
class OfflineBuffer
{
public:
    // Maximum file size before new pushes are rejected (~1800 readings ≈ 2.5 h).
    static const size_t OFFLINE_BUFFER_MAX_BYTES = 200000;
    static const char *BUFFER_FILE;

    /**
     * Mount LittleFS.  Call once from setup().
     * Returns false if the filesystem cannot be mounted/formatted.
     */
    bool begin();

    /**
     * Append one reading to the buffer file.
     * No-op when:
     *  - LittleFS is not mounted.
     *  - Buffer file is at or above OFFLINE_BUFFER_MAX_BYTES.
     *  - epochSec == 0 (no time reference available; reading would land at wrong time).
     */
    void push(const ReadingPayload &payload, uint32_t epochSec);

    /** Returns true when there are buffered readings waiting to be replayed. */
    bool hasPending();

    /**
     * Read the buffer file line-by-line and POST each entry via BackendClient.
     * Deletes the file only when every entry has been successfully sent.
     * Stops early (file kept) on the first POST failure.
     * @param client   BackendClient instance used for POSTing.
     * @param delayMs  Pause between successive POSTs to avoid flooding the server.
     */
    void replayAll(BackendClient &client, unsigned int delayMs = 50);

    /** Delete the buffer file unconditionally. */
    void clear();

private:
    bool mounted_ = false;
};

#endif
