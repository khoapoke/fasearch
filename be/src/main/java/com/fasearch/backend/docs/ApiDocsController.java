package com.fasearch.backend.docs;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Local-only API documentation. Serves the canonical public contract verbatim
 * plus a standard Swagger UI page on the same origin so the browser keeps the
 * opaque HttpOnly session cookie. Not loaded in the {@code prod} profile.
 */
@Profile("!prod")
@RestController
@RequestMapping("/docs")
public class ApiDocsController {

	private static final String SWAGGER_UI_VERSION = "5.17.0";

	@GetMapping(path = "/openapi.json", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<byte[]> openapi() throws IOException {
		ClassPathResource resource = new ClassPathResource("docs/openapi.json");
		try (InputStream input = resource.getInputStream()) {
			byte[] body = input.readAllBytes();
			return ResponseEntity.ok()
					.contentType(MediaType.APPLICATION_JSON)
					.body(body);
		}
	}

	@GetMapping(produces = MediaType.TEXT_HTML_VALUE)
	public ResponseEntity<String> swaggerPage() {
		String html = """
				<!DOCTYPE html>
				<html lang="en">
				<head>
				  <meta charset="utf-8" />
				  <meta name="viewport" content="width=device-width, initial-scale=1" />
				  <title>FaSearch API docs</title>
				  <link rel="icon" href="data:," />
				  <link rel="stylesheet" href="/webjars/swagger-ui/%s/swagger-ui.css" />
				</head>
				<body>
				  <div id="swagger-ui"></div>
				  <script src="/webjars/swagger-ui/%s/swagger-ui-bundle.js"></script>
				  <script src="/webjars/swagger-ui/%s/swagger-ui-standalone-preset.js"></script>
				  <script>
				    window.ui = SwaggerUIBundle({
				      url: "/docs/openapi.json",
				      dom_id: "#swagger-ui",
				      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
				      layout: "StandaloneLayout",
				      withCredentials: true,
				      persistAuthorization: true
				    });
				  </script>
				  <noscript>FaSearch API docs require JavaScript for Swagger UI.</noscript>
				</body>
				</html>
				""".formatted(SWAGGER_UI_VERSION, SWAGGER_UI_VERSION, SWAGGER_UI_VERSION);
		return ResponseEntity.ok()
				.contentType(MediaType.TEXT_HTML)
				.contentLength(html.getBytes(StandardCharsets.UTF_8).length)
				.body(html);
	}
}
