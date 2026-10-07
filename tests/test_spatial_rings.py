from scripts.climaterisk.build_spatial_context import esri_polygon, threat_class


def test_clockwise_shell_with_a_hole_keeps_both():
    shell = [[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]]
    hole = [[0.5, 0.5], [1.2, 0.5], [1.2, 1.2], [0.5, 1.2], [0.5, 0.5]]
    geometry = esri_polygon([shell, hole])
    assert geometry.geom_type == "Polygon"
    assert len(geometry.interiors) == 1
    assert round(geometry.area, 2) == 3.51


def test_single_counterclockwise_ring_is_not_dropped():
    ring = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]
    geometry = esri_polygon([ring])
    assert geometry is not None
    assert geometry.area == 1


def test_threat_labels_stay_on_the_hazard_scale():
    assert threat_class("Amenaza alta") == "alta"
    assert threat_class("Amenaza media") == "media"
    assert threat_class("Amenaza baja") == "baja"
