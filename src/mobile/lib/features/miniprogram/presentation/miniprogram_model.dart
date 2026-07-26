/// Datenmodell für ein Mini-Programm im HEIMAT-Ökosystem.
/// Mini-Programme sind externe Web-Apps, die in einem WebView-Container
/// innerhalb der HEIMAT-App ausgeführt werden (wie WeChat Mini-Programs).
class MiniProgram {
  final String id;
  final String name;
  final String url;
  final String iconPath;
  final String description;
  final String category;
  final bool isActive;

  const MiniProgram({
    required this.id,
    required this.name,
    required this.url,
    required this.iconPath,
    required this.description,
    required this.category,
    this.isActive = true,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'url': url,
        'icon': iconPath,
        'description': description,
        'category': category,
        'isActive': isActive,
      };

  factory MiniProgram.fromJson(Map<String, dynamic> json) => MiniProgram(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        url: json['url'] as String? ?? '',
        iconPath: json['icon'] as String? ?? 'apps',
        description: json['description'] as String? ?? '',
        category: json['category'] as String? ?? 'Allgemein',
        isActive: json['isActive'] as bool? ?? true,
      );

  @override
  String toString() => 'MiniProgram($id: $name)';
}
