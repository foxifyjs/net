{
  "targets": [{
    "target_name": "socket",
    "include_dirs": [
      "<!(node -e \"require('napi-macros')\")"
    ],
    "sources": [
      "./src/socket.c"
    ],
    "xcode_settings": {
      "OTHER_CFLAGS": [
        "-O3",
        "-std=c99",
        "-D_GNU_SOURCE"
      ]
    },
    "cflags": [
      "-O3",
      "-std=c99",
      "-D_GNU_SOURCE"
    ],
    "conditions": [
      ['OS=="win"', {
        "link_settings": {
          "libraries": [
            "-lws2_32.lib"
          ]
        }
      }]
    ],
  }]
}
