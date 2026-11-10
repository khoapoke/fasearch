package com.springboot.fasearch.modules.order.client;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.*;
import com.springboot.fasearch.exception.*;

/** Fixed Google endpoints only. Credentials never leave this client or enter logs. */
@Component
public class GoogleMapsClient {
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final ObjectMapper json = new ObjectMapper();
    private final String key;
    private record Cached(JsonNode value, long expires) {}
    private final Map<String,Cached> cache = new ConcurrentHashMap<>();
    private record Window(long start, int count) {}
    private final Map<String,Window> users = new HashMap<>();
    public GoogleMapsClient() {
        String configured = System.getenv("GOOGLE_MAPS_API_KEY");
        if (configured == null || configured.isBlank()) {
            Path file = Path.of(System.getProperty("user.home"), ".config/fasearch/google-maps.env");
            try {
                if (Files.isRegularFile(file)) for (String line : Files.readAllLines(file)) {
                    if (line.startsWith("GOOGLE_MAPS_API_KEY=")) {
                        configured=line.substring(line.indexOf('=')+1).strip();
                        if (configured.length()>1 && ((configured.startsWith("\"") && configured.endsWith("\""))
                            || (configured.startsWith("'") && configured.endsWith("'")))) configured=configured.substring(1,configured.length()-1);
                    }
                }
            } catch (java.io.IOException ignored) { /* missing/unreadable key means fallback */ }
        }
        key = configured == null ? "" : configured.strip();
    }
    public boolean enabled() { return !key.isBlank(); }
    public synchronized void allow(String user) {
        if (!enabled()) throw new AppException(ErrorCode.MAPS_NOT_CONFIGURED);
        long now=System.currentTimeMillis();
        users.entrySet().removeIf(e -> now-e.getValue().start()>60000);
        Window window=users.get(user);
        if (window != null && window.count()>=20) throw new AppException(ErrorCode.MAPS_RATE_LIMITED);
        if (users.size()>=10000 && window==null) throw new AppException(ErrorCode.MAPS_RATE_LIMITED);
        users.put(user,new Window(window==null ? now : window.start(),window==null ? 1 : window.count()+1));
    }
    private JsonNode call(String cacheKey, String url, Object body, String mask) {
        if (!enabled()) throw new AppException(ErrorCode.MAPS_NOT_CONFIGURED);
        Cached prior=cache.get(cacheKey);
        if (prior != null && prior.expires()>System.currentTimeMillis()) return prior.value();
        try {
            HttpRequest.Builder request=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(3));
            if (body != null) request.header("X-Goog-Api-Key",key).header("Content-Type","application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
            if (mask != null) request.header("X-Goog-FieldMask",mask);
            HttpResponse<String> response=http.send(request.build(),HttpResponse.BodyHandlers.ofString());
            if (response.statusCode()!=200) throw new AppException(ErrorCode.MAPS_UNAVAILABLE);
            JsonNode value=json.readTree(response.body());
            if (cache.size()>2000) cache.clear();
            cache.put(cacheKey,new Cached(value,System.currentTimeMillis()+300000));
            return value;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); throw new AppException(ErrorCode.MAPS_UNAVAILABLE);
        } catch (Exception e) { throw new AppException(ErrorCode.MAPS_UNAVAILABLE); }
    }
    private Map<String,Object> point(double lat,double lng) {
        return Map.of("location",Map.of("latLng",Map.of("latitude",lat,"longitude",lng)));
    }
    public Double distance(double fromLat,double fromLng,double lat,double lng) {
        if (!enabled()) return null;
        // Round actual route endpoints as well as keys to make cached prices deterministic.
        lat=Math.round(lat*10000d)/10000d; lng=Math.round(lng*10000d)/10000d;
        try {
            JsonNode result=call("route:"+fromLat+":"+fromLng+":"+lat+":"+lng,
                "https://routes.googleapis.com/directions/v2:computeRoutes",
                Map.of("origin",point(fromLat,fromLng),"destination",point(lat,lng),"travelMode","DRIVE"),"routes.distanceMeters");
            JsonNode meters=result.path("routes").path(0).path("distanceMeters");
            return meters.isNumber() && meters.asDouble()>=0 ? meters.asDouble()/1000d : null;
        } catch (AppException e) { return null; }
    }
    public record Suggestion(String placeId,String label) {}
    public List<Suggestion> autocomplete(String input) {
        JsonNode result=call("auto:"+input,"https://places.googleapis.com/v1/places:autocomplete",
            Map.of("input",input,"includedRegionCodes",List.of("vn"),"languageCode","vi"),
            "suggestions.placePrediction.placeId,suggestions.placePrediction.text");
        List<Suggestion> out=new ArrayList<>();
        for (JsonNode item:result.path("suggestions")) {
            JsonNode p=item.path("placePrediction");
            if (p.hasNonNull("placeId")) out.add(new Suggestion(p.path("placeId").asText(),p.path("text").path("text").asText()));
        }
        return out;
    }
    public record Location(double latitude,double longitude,String formattedAddress,String placeId) {}
    public Location geocode(String address,String placeId) {
        String query=placeId==null ? "address="+encode(address) : "place_id="+encode(placeId);
        JsonNode result=call("geo:"+query,"https://maps.googleapis.com/maps/api/geocode/json?"+query+"&language=vi&key="+encode(key),null,null);
        JsonNode first=result.path("results").path(0), loc=first.path("geometry").path("location");
        if (!loc.path("lat").isNumber() || !loc.path("lng").isNumber()) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND);
        return new Location(loc.path("lat").asDouble(),loc.path("lng").asDouble(),first.path("formatted_address").asText(),first.path("place_id").asText());
    }
    private String encode(String s) { return URLEncoder.encode(s,StandardCharsets.UTF_8); }
}
