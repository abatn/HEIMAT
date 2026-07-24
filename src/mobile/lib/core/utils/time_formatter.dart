String formatTransitTime(String isoString) {
  try {
    final dt = DateTime.parse(isoString);
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  } catch (_) {
    final parts = isoString.split('T');
    final timePart = parts.length > 1 ? parts.last : isoString;
    final tParts = timePart.split(':');
    return tParts.length >= 2 ? '${tParts[0]}:${tParts[1]}' : isoString;
  }
}
